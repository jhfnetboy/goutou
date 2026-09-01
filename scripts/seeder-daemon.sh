#!/bin/bash
# Seeder 健康守护 (watchdog)。LaunchDaemon com.goutou.seeder-watchdog 每 60s 调用
# （以 UserName=jason 身份运行：开机即起、不依赖登录，但不带 root 特权）。
#
# ⚠️ 职责边界（v3）：本脚本**绝不自己 spawn 服务进程**，也**不持有 root**。
#   服务本体由 LaunchDaemon com.goutou.seeder (KeepAlive) 监管，见 scripts/seeder-run.sh。
#   本脚本只做 launchd 看不见的那层判断 —— 「进程还在，但 HTTP 已经废了」的僵尸态
#   （典型：.next 被 Cloudflare 产物覆盖 ⇒ /api/mcp 500 + workerd ECONNREFUSED）。
#   需要重启时 kill 掉服务进程，由 com.goutou.seeder 的 KeepAlive 把它拉回来。
#
#   历史事故（2026-08-26 定位）：v1 版本自己 nohup 拉起 next 然后立刻 exit。
#   launchd 的 AbandonProcessGroup 默认 false ⇒ job 主进程退出时，同进程组残留
#   进程一律 SIGKILL。nohup 只挡 SIGHUP、disown 只改 bash 作业表，都拦不住。
#   结果：拉起 1132 次，只有 3 次活到打印启动 banner。守护进程在杀自己拉起的服务。
#
# 健康判据：带【真 PAT】打 /api/mcp initialize —— 200 才算 D1/libsql 真活着。
#   - 200 = 健康   - 401 = 无 PAT 时的降级判据   - 5xx = 僵尸   - 000 = 没监听
#
# ⚠️ 中文日志里的变量一律写 ${VAR} 而不是 $VAR。
#   bash 判定变量名用 locale 相关的 isalnum()，UTF-8 下全角标点（如「（」U+FF08）
#   的首字节会被当成名字的一部分 —— `$DST（…` 会去找一个并不存在的变量 `DST\xef…`，
#   在 set -u 下直接中止脚本。2026-08-31 安装脚本就是这样在中途炸掉，
#   而此时旧 LaunchAgent 已被卸载，Seeder 处于无人监管状态。
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
HEARTBEAT="$REPO/.seeder-watchdog-heartbeat"   # 每轮都写，用来证明 watchdog 自己还活着
HEALTH_URL="http://localhost:$PORT/api/mcp"
SVC="com.goutou.seeder"
# 服务 job 可能挂在两个域：
#   system/…      LaunchDaemon（开机即起，推荐形态）
#   gui/<uid>/…   LaunchAgent（迁移前的旧形态，登录后才跑）
# 两种都要支持 —— 否则迁移窗口期内 watchdog 会一直判「未挂载」而空转。
# （实际教训：2026-08-26 改成只认 system 域后，因安装脚本尚未执行，
#   watchdog 连续 5 天每 60s 报错退出，僵尸检测层静默下线。）
# 重启走 kill + KeepAlive，与域无关，所以域只用于「是否挂载」判断和取 pid。
SVC_TARGET=""
resolve_target() {
  local t
  for t in "system/$SVC" "gui/$(id -u)/$SVC"; do
    if launchctl print "$t" >/dev/null 2>&1; then SVC_TARGET="$t"; return 0; fi
  done
  return 1
}

GRACE=90         # 秒：重启后不判死的宽限期（构建期另由 BUILDING 标记避让）
BUILD_GRACE=420  # 秒：若检测到正在跑 build:node，放宽到 7 分钟
MAXFAILS=4       # 连续失败阈值，超过进入退避
BACKOFF=600      # 秒：退避期重试间隔
MAXLOG=2000000   # 字节：日志轮转阈值（2MB），防无限增长

ts() { date '+%F %T'; }
now() { date +%s; }
log() { echo "[$(ts)] $*" >> "$LOG"; }

rotate() { # 防日志把磁盘吃满
  # ⚠️ 必须「拷贝 + 原地清空」，不能 mv。launchd 对 StandardOutPath 持有一个常开 fd：
  #    mv 之后那个 fd 仍指向被改名的旧 inode，服务会继续往 .1 里写，而新建的空文件
  #    永远不增长 —— 看上去「日志停了」。原地 truncate 保留 inode 和属主，
  #    launchd 的 fd 是 O_APPEND，下一次写自然落到偏移 0。
  local f sz
  for f in "$LOG" "$REPO/.seeder-server.log"; do
    [ -f "$f" ] || continue
    sz=$(stat -f%z "$f" 2>/dev/null || echo 0)
    if [ "$sz" -gt "$MAXLOG" ]; then
      cp -f "$f" "$f.1" 2>/dev/null && : > "$f"
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

# 重启服务 = 杀掉它，剩下的交给 com.goutou.seeder 的 KeepAlive。
# 为什么不用 `launchctl kickstart -k system/...`：操作 system 域需要 root，
# 而本脚本以普通用户身份跑（daemon 里设了 UserName=jason，避免 root 造出
# root 属主的 .next / sqlite 文件把用户日常开发搞坏）。服务进程同属 jason，
# 直接 kill 得动，launchd 会在 ThrottleInterval 内把它拉回来 —— 等价效果，零特权。
restart_service() {
  local pids
  # 优先杀端口上的监听者（僵尸态：进程活着但 HTTP 已废，这是 KeepAlive 看不见的情况）
  pids=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null)
  # 没在监听 ⇒ 从 launchd 问它管的 pid（进程活着但根本没 bind 成功）
  if [ -z "$pids" ]; then
    pids=$(launchctl print "$SVC_TARGET" 2>/dev/null | awk '/^\s*pid = /{print $3; exit}')
  fi
  if [ -n "$pids" ]; then
    log "kill -9 ${pids}（由 KeepAlive 自动拉回）"
    kill -9 $pids 2>/dev/null
  else
    log "找不到可杀的进程 —— 服务应已不在，等 KeepAlive 拉起"
  fi
}

# ================= 主流程 =================
# 心跳：健康时本脚本全程静默，没有任何输出 —— 于是「watchdog 自己死了」这件事
# 无法被观测到。2026-08-26~31 它因指向了不存在的 job 每 60s 报错退出，
# 静默失效整整 5 天，期间僵尸检测层是空的，而表面一切正常。
# 每轮无条件写一行时间戳，任何人都能一眼看出它上次是什么时候跑的：
#   cat .seeder-watchdog-heartbeat
date '+%F %T' > "$HEARTBEAT" 2>/dev/null || true

rotate
load_state

# 服务 job 没挂载 ⇒ 只能报警。挂载 system 域要 root，本脚本刻意不持有特权。
# 正常情况下 LaunchDaemon 开机即挂载、不会自行卸载，走到这里说明压根没装或被手工 bootout。
if ! resolve_target; then
  log "❌ $SVC 在 system 域和用户域都未挂载！请执行：sudo bash $REPO/scripts/install-daemons.sh"
  exit 1
fi
# 仍是旧的 LaunchAgent 形态 ⇒ 能正常工作，但只在登录后才跑，提醒迁移（每 30 分钟提一次，不刷屏）
if [ "${SVC_TARGET#gui/}" != "$SVC_TARGET" ]; then
  if [ $(( $(now) % 1800 )) -lt 60 ]; then
    log "ℹ️ $SVC 仍是 LaunchAgent（登录后才跑）。迁移到开机即起：sudo bash $REPO/scripts/install-daemons.sh"
  fi
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

# 正在构建 ⇒ 直接放行，绝不重启。build 是分钟级的，腰斩它只会留下半残 .next，
# 逼下一轮重编译 —— 越急越慢。
if building; then
  exit 0
fi

# ① 启动宽限期：刚重启的实例还在 boot，别急着判死
if [ $((N - st_last_restart)) -lt $GRACE ]; then
  exit 0
fi

# ② 失败退避：连续崩太多次，低频重试并报警
if [ "$st_fails" -ge "$MAXFAILS" ] && [ $((N - st_last_restart)) -lt $BACKOFF ]; then
  log "⚠️ Seeder 连续 $st_fails 次重启仍不健康 (HTTP ${code:-000})，退避中，$((BACKOFF - (N - st_last_restart)))s 后再试"
  exit 0
fi

# ③ 僵尸态：产物很可能被 Cloudflare build 覆盖，清掉 marker 逼 seeder-run.sh 重建
if [[ "$code" =~ ^5 ]]; then
  log "检测到僵尸态 (HTTP $code)，清除 node-build marker 以强制 build:node"
  rm -f "$REPO/.next/.node-build-marker"
fi

log "Seeder 不健康 (HTTP ${code:-000}) → 重启 (连续失败 $st_fails 次)"
restart_service
st_fails=$((st_fails + 1)); st_last_restart=$N; save_state
exit 0
