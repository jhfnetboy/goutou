#!/bin/bash
# Seeder 健康守护 (watchdog)。由 launchd 每 60s 调用一次，也可手动跑。幂等、单实例。
#
# 健康判据：带【真 PAT】打 /api/mcp initialize —— 200 才算 D1 真活着（auth 解析 PAT 要查 D1）。
#   - 200 = 健康     - 401 = 拿不到 PAT 时的降级判据（应用在，但没证到 D1）
#   - 5xx = 僵尸（D1/workerd 代理死了）    - 000 = 进程死/未监听
#
# 三个防「渣」设计（历史事故：一分钟一次无脑重启的 boot-crash 死循环）：
#   ① ensure_node_build —— driver 是 build 时按 RUNTIME 决定打包（build:node=libsql，build=d1）。
#       若 .next/BUILD_ID 不是 node 构建标记（例如被 `npm run build` 覆盖成 Cloudflare 产物），
#       先 `build:node` 重建，否则 `next start` 会命中 d1/workerd → ECONNREFUSED → 必崩。
#   ② 启动宽限期 GRACE —— 刚(重)启的实例在 GRACE 秒内不判死、不重杀，给它 boot 时间。
#   ③ 失败退避 BACKOFF —— 连续 MAXFAILS 次拉起仍不健康，改成每 BACKOFF 秒才试一次并大声记日志，
#       不再每 60s 锤，避免「一直崩一直重启」把进程/内存刷爆。
set -u

# launchd 环境 PATH 极简，显式补齐 node(nvm)/pnpm/系统工具
export PATH="/Users/jason/.nvm/versions/node/v22.22.2/bin:/Users/jason/Library/pnpm:/usr/local/bin:/opt/homebrew/bin:/usr/sbin:/usr/bin:/bin:/sbin"

REPO="$HOME/Dev/jhfnetboy/goutou"
PORT=7399
LOG="$REPO/.seeder-dev.log"
STATE="$REPO/.seeder-daemon.state"
HEALTH_URL="http://localhost:$PORT/api/mcp"

GRACE=45         # 秒：刚(重)启后不判死的宽限期
MAXFAILS=4       # 连续失败次数阈值，超过后进入退避
BACKOFF=600      # 秒：退避期内的重试间隔（10 分钟）

ts() { date '+%F %T'; }
now() { date +%s; }
log() { echo "[$(ts)] $*" >> "$LOG"; }

# ---- 状态读写（key=val，跨 launchd 调用持久化）----
st_last_restart=0; st_fails=0; st_node_build_id=""
load_state() {
  [ -f "$STATE" ] || return 0
  # shellcheck disable=SC1090
  while IFS='=' read -r k v; do
    case "$k" in
      last_restart) st_last_restart=${v:-0} ;;
      fails)        st_fails=${v:-0} ;;
      node_build_id) st_node_build_id=${v:-} ;;
    esac
  done < "$STATE"
}
save_state() {
  { echo "last_restart=$st_last_restart"
    echo "fails=$st_fails"
    echo "node_build_id=$st_node_build_id"; } > "$STATE"
}

# ---- 取 seeder PAT（不硬编码；PAT 轮换自动跟随）----
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

# ① 保证服务端产物是 node(libsql) 构建，不是被覆盖的 Cloudflare(d1) 产物
ensure_node_build() {
  local cur; cur=$(cat "$REPO/.next/BUILD_ID" 2>/dev/null || echo "")
  if [ -n "$cur" ] && [ "$cur" = "$st_node_build_id" ]; then
    return 0   # 已是已知的 node 产物
  fi
  log "产物非 node 构建 (have=${cur:-none}, node=${st_node_build_id:-none}) → 运行 build:node"
  ( cd "$REPO" && npm run build:node ) >> "$LOG" 2>&1
  if [ $? -eq 0 ] && [ -f "$REPO/.next/BUILD_ID" ]; then
    st_node_build_id=$(cat "$REPO/.next/BUILD_ID")
    log "build:node 完成，node_build_id=$st_node_build_id"
    return 0
  fi
  log "❌ build:node 失败，本轮放弃重启"
  return 1
}

restart_seeder() {
  # 杀掉占用 7399 的旧监听进程（僵尸/错产物），按端口精确匹配避免误杀别的 next 项目
  local pids; pids=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  pkill -f "next start -p $PORT" 2>/dev/null
  pkill -f "next start --port $PORT" 2>/dev/null
  pkill -f "next dev --port $PORT" 2>/dev/null   # 过渡期兼容旧 dev 实例
  sleep 2

  cd "$REPO" || { log "找不到仓库 $REPO"; return 1; }
  # next start 不读 .dev.vars（那是 wrangler 的），自己把密钥 + node 专用 env 喂进去
  set -a; source ./.dev.vars 2>/dev/null; set +a
  export RUNTIME=node
  export SQLITE_DB_PATH="$REPO/data/seeder.db"
  export PORT=$PORT
  export BETTER_AUTH_URL="http://localhost:$PORT"
  nohup "$REPO/node_modules/.bin/next" start -p "$PORT" >> "$LOG" 2>&1 &
  disown 2>/dev/null || true
  log "已重新拉起 Seeder (RUNTIME=node next start -p $PORT, pid $!)"
}

# ================= 主流程 =================
load_state
code=$(health_code)
N=$(now)

if is_healthy "$code"; then
  if [ "$st_fails" != "0" ]; then
    log "Seeder 恢复健康 (HTTP $code)，清零失败计数"
    st_fails=0; save_state
  fi
  exit 0
fi

# ② 启动宽限期：刚(重)启的实例还在 boot，别急着判死重杀
if [ $((N - st_last_restart)) -lt $GRACE ]; then
  exit 0
fi

# ③ 失败退避：连续崩太多次，改成低频重试并大声报警，不再每 60s 锤
if [ "$st_fails" -ge "$MAXFAILS" ] && [ $((N - st_last_restart)) -lt $BACKOFF ]; then
  log "⚠️ Seeder 连续 $st_fails 次拉起仍不健康 (HTTP ${code:-000})，退避中，$((BACKOFF - (N - st_last_restart)))s 后再试"
  exit 0
fi

log "Seeder 不健康 (HTTP ${code:-000}) → 准备重启 (连续失败 $st_fails 次)"

if ! ensure_node_build; then
  st_fails=$((st_fails + 1)); st_last_restart=$N; save_state
  exit 1
fi

restart_seeder
st_fails=$((st_fails + 1)); st_last_restart=$N; save_state
exit 0
