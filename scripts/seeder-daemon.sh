#!/bin/bash
# Seeder 健康守护 (watchdog)。由 launchd 每 60s 调用一次，也可手动跑。
#
# 关键：健康检查必须真正打到 D1。dev 模式下 next-server 主进程常常活着，但
# 它连的 miniflare/workerd D1 代理端口会死掉（ECONNREFUSED 127.0.0.1:<随机端口>），
# 导致所有 D1 路由 500——而无 auth 的 /api/mcp 只返回 401（根本不碰 D1），会误报健康。
# 所以这里用【真 PAT】做 initialize：
#   - 200 = 完全健康（auth 解析 PAT 需查 D1，200 证明 D1 活着）
#   - 401 = 仅当拿不到 PAT 时的降级判据（应用在响应，但无法确证 D1）
#   - 5xx = 僵尸（D1 代理死了）        - 000 = 进程死
# 不健康则杀掉占用 7399 的旧进程（含僵尸）并重新拉起。健康则空转退出。幂等单实例。
set -u

# launchd 环境 PATH 极简，显式补齐 node(nvm)/pnpm/系统工具
export PATH="/Users/jason/.nvm/versions/node/v22.22.2/bin:/Users/jason/Library/pnpm:/usr/local/bin:/opt/homebrew/bin:/usr/sbin:/usr/bin:/bin:/sbin"

REPO="$HOME/Dev/jhfnetboy/goutou"
PORT=7399
LOG="$REPO/.seeder-dev.log"
HEALTH_URL="http://localhost:$PORT/api/mcp"

ts() { date '+%F %T'; }

# 从 ~/.claude.json 现取 seeder PAT（不硬编码进仓库；PAT 轮换自动跟随）
PAT=$(node -e "try{const c=require(process.env.HOME+'/.claude.json');const a=(c.mcpServers&&c.mcpServers.seeder&&c.mcpServers.seeder.headers&&c.mcpServers.seeder.headers.Authorization)||'';process.stdout.write(a.replace(/^Bearer\s+/i,''))}catch(e){}" 2>/dev/null)

if [ -n "$PAT" ]; then
  # 带真 PAT 的 initialize → 必须 200（证明 D1 活着）
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -X POST "$HEALTH_URL" \
    -H "Authorization: Bearer $PAT" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"watchdog","version":"1"}}}' 2>/dev/null)
  [ "$code" = "200" ] && exit 0   # D1 健康
else
  # 降级：拿不到 PAT 时，只能用无 auth 判据（无法确证 D1，聊胜于无）
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 \
    -X POST "$HEALTH_URL" -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' 2>/dev/null)
  echo "[$(ts)] ⚠️ 未能从 ~/.claude.json 取到 PAT，降级用无auth判据(不保证D1)" >> "$LOG"
  [[ "$code" =~ ^(401|405)$ ]] && exit 0
fi

echo "[$(ts)] Seeder 不健康 (HTTP ${code:-000}) → 重启" >> "$LOG"

# 杀掉占用 7399 的旧监听进程；pkill 只按 7399 端口精确匹配，避免误杀别的 next 项目
pids=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null)
[ -n "$pids" ] && kill -9 $pids 2>/dev/null
pkill -f "next start -p $PORT" 2>/dev/null
pkill -f "next dev --port $PORT" 2>/dev/null   # 过渡期兼容旧 dev 实例
sleep 2

cd "$REPO" || { echo "[$(ts)] 找不到仓库 $REPO" >> "$LOG"; exit 1; }

# Node runtime 启动（RUNTIME=node + libsql SQLite 文件，无 miniflare/workerd 子进程）。
# next start 不读 .dev.vars（那是 wrangler 的），需自己把密钥 + node 专用 env 喂进去。
set -a; source ./.dev.vars 2>/dev/null; set +a
export RUNTIME=node
export SQLITE_DB_PATH="$REPO/data/seeder.db"
export PORT=$PORT
export BETTER_AUTH_URL="http://localhost:$PORT"
nohup "$REPO/node_modules/.bin/next" start -p "$PORT" >> "$LOG" 2>&1 &
disown 2>/dev/null || true
echo "[$(ts)] 已重新拉起 Seeder (RUNTIME=node next start -p $PORT, pid $!)" >> "$LOG"
exit 0
