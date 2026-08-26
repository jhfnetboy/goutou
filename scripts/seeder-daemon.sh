#!/bin/bash
# Seeder 健康守护 (watchdog)。由 launchd (com.goutou.seeder-watchdog) 每 60s 调用。
#
# ⚠️ 职责边界（v2 重构）：本脚本**绝不自己 spawn 服务进程**。
#   服务本体由 com.goutou.seeder (KeepAlive) 监管，见 scripts/seeder-run.sh。
#   本脚本只做 launchd 看不见的那层判断 —— 「进程还在，但 HTTP 已经废了」的僵尸态
#   （典型：.next 被 Cloudflare 产物覆盖 ⇒ /api/mcp 500 + workerd ECONNREFUSED）。
#   需要重启时调 `launchctl kickstart -k`，把动作交回 launchd。
#
#   历史事故（2026-08-26 定位）：v1 版本自己 nohup 拉起 next 然后立刻 exit。
#   launchd 的 AbandonProcessGroup 默认 false ⇒ job 主进程退出时，同进程组残留
#   进程一律 SIGKILL。nohup 只挡 SIGHUP、disown 只改 bash 作业表，都拦不住。
#   结果：拉起 1132 次，只有 3 次活到打印启动 banner。守护进程在杀自己拉起的服务。
#
# 健康判据：带【真 PAT】打 /api/mcp initialize —— 200 才算 D1/libsql 真活着。
#   - 200 = 健康   - 401 = 无 PAT 时的降级判据   - 5xx = 僵尸   - 000 = 没监听
set -u

# launchd 环境 PATH 极简，显式补齐 node(nvm)/pnpm/系统工具
NODE_BIN=""
for d in /Users/jason/.nvm/versions/node/v22.22.2/bin \
         /Users/jason/.nvm/versions/node/*/bin \
         /opt/homebrew/bin /usr/local/bin; do
  [ -x "$d/node" ] && { NODE_BIN="$d"; break; }
done
export PATH="${NODE_BIN:+$NODE_BIN:}/Users/jason/Library/pnpm:/usr/local/bin:/opt/homebrew/bin:/usr/sbin:/usr/bin:/bin:/sbin"

REPO="$HOME/Dev/jhfnetboy/goutou"
PORT=7399
LOG="$REPO/.seeder-watchdog-health.log"
STATE="$REPO/.seeder-daemon.state"
BUILDING="$REPO/.seeder-building"   # 由 seeder-run.sh 维护的「构建中」标记
HEALTH_URL="http://localhost:$PORT/api/mcp"
SVC="com.goutou.seeder"
SVC_TARGET="gui/$(id -u)/$SVC"

GRACE=90         # 秒：kickstart 后不判死的宽限期（含可能的 build:node 时间由 BUILD 宽限覆盖）
BUILD_GRACE=420  # 秒：若检测到正在跑 build:node，放宽到 7 分钟
MAXFAILS=4       # 连续失败阈值，超过进入退避
BACKOFF=600      # 秒：退避期重试间隔
MAXLOG=2000000   # 字节：日志轮转阈值（2MB），防无限增长

ts() { date '+%F %T'; }
now() { date +%s; }
log() { echo "[$(ts)] $*" >> "$LOG"; }

rotate() { # 防日志把磁盘吃满
  for f in "$LOG" "$REPO/.seeder-server.log"; do
    if [ -f "$f" ]; then
      sz=$(stat -f%z "$f" 2>/dev/null || echo 0)
      [ "$sz" -gt "$MAXLOG" ] && { mv -f "$f" "$f.1" 2>/dev/null; : > "$f"; }
    fi
  done
}

st_last_restart=0; st_fails=0
load_state() {
  # state 缺失（首次运行 / 被手动清掉）：把 last_restart 视作「此刻」，
  # 让首轮享受 GRACE 宽限，而不是 0 → 立刻判死重启一个可能刚起来的实例。
  [ -f "$STATE" ] || { st_last_restart=$(now); return 0; }
  while IFS='=' read -r k v; do
    case "$k" in
      last_restart) st_last_restart=${v:-0} ;;
      fails)        st_fails=${v:-0} ;;
    esac
  done < "$STATE"
}
save_state() {
  { echo "last_restart=$st_last_restart"; echo "fails=$st_fails"; } > "$STATE"
}

# 取 seeder PAT（不硬编码，PAT 轮换自动跟随）
PAT=$(node -e "try{const c=require(process.env.HOME+'/.claude.json');const a=(c.mcpServers&&c.mcpServers.seeder&&c.mcpServers.seeder.headers&&c.mcpServers.seeder.headers.Authorization)||'';process.stdout.write(a.replace(/^Bearer\s+/i,''))}catch(e){}" 2>/dev/null)

health_code() {
  if [ -n "$PAT" ]; then
    curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -X POST "$HEALTH_URL" \
      -H "Authorization: Bearer $PAT" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"watchdog","version":"1"}}}' 2>/dev/null
  else
    curl -s -o /dev/null -w "%{http_code}" --max-time 12 \
      -X POST "$HEALTH_URL" -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' 2>/dev/null
  fi
}

is_healthy() { # $1=code
  if [ -n "$PAT" ]; then [ "$1" = "200" ]; else [[ "$1" =~ ^(401|405)$ ]]; fi
}

# 是否正在跑 build:node。以 seeder-run.sh 落的标记文件为准 ——
# Next 会重写进程标题，`pgrep -f "next build"` 实测匹配不到（2026-08-26 演练中
# watchdog 因此腰斩了一次正在进行的 build，逼得 build 跑了两遍）。
# 标记带时间戳：超过 BUILD_GRACE 视为 stale（build 进程被杀留下的残留），不再避让。
building() {
  if [ -f "$BUILDING" ]; then
    local started age
    started=$(cat "$BUILDING" 2>/dev/null || echo 0)
    age=$(( $(now) - ${started:-0} ))
    if [ "$age" -lt "$BUILD_GRACE" ]; then
      return 0
    fi
    log "⚠️ 构建标记已 stale (${age}s > ${BUILD_GRACE}s)，清除后按正常流程处理"
    rm -f "$BUILDING"
  fi
  pgrep -f "next build" >/dev/null 2>&1
}

# ================= 主流程 =================
rotate
load_state

# 服务 job 没挂载 ⇒ 挂载它（唯一一次「安装」动作，不算重启）
if ! launchctl print "$SVC_TARGET" >/dev/null 2>&1; then
  log "⚠️ $SVC 未挂载 → bootstrap"
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/$SVC.plist" 2>/dev/null
  st_last_restart=$(now); save_state
  exit 0
fi

code=$(health_code)
N=$(now)

if is_healthy "$code"; then
  if [ "$st_fails" != "0" ]; then
    log "Seeder 恢复健康 (HTTP $code)，清零失败计数"
    st_fails=0; save_state
  fi
  exit 0
fi

# 正在构建 ⇒ 直接放行，绝不 kickstart。build 是分钟级的，腰斩它只会留下半残 .next，
# 逼下一轮重编译 —— 越急越慢。
if building; then
  exit 0
fi

# ① 启动宽限期：刚 kickstart 的实例还在 boot，别急着判死
if [ $((N - st_last_restart)) -lt $GRACE ]; then
  exit 0
fi

# ② 失败退避：连续崩太多次，低频重试并报警
if [ "$st_fails" -ge "$MAXFAILS" ] && [ $((N - st_last_restart)) -lt $BACKOFF ]; then
  log "⚠️ Seeder 连续 $st_fails 次 kickstart 仍不健康 (HTTP ${code:-000})，退避中，$((BACKOFF - (N - st_last_restart)))s 后再试"
  exit 0
fi

# ③ 僵尸态：产物很可能被 Cloudflare build 覆盖，清掉 marker 逼 seeder-run.sh 重建
if [[ "$code" =~ ^5 ]]; then
  log "检测到僵尸态 (HTTP $code)，清除 node-build marker 以强制 build:node"
  rm -f "$REPO/.next/.node-build-marker"
fi

log "Seeder 不健康 (HTTP ${code:-000}) → kickstart -k $SVC (连续失败 $st_fails 次)"
launchctl kickstart -k "$SVC_TARGET" 2>&1 | sed "s/^/[$(ts)] kickstart: /" >> "$LOG"
st_fails=$((st_fails + 1)); st_last_restart=$N; save_state
exit 0
