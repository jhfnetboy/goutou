#!/bin/bash
# Seeder 服务本体启动器 —— 由 launchd (com.goutou.seeder, KeepAlive) 直接监管。
#
# 关键设计：本脚本最后 `exec` 进 next start，**前台**运行，永不返回。
#   launchd 因此把 next 进程本身当作 job 的主进程 —— 它崩了 launchd 立刻重启，
#   而不是像旧 watchdog 那样「spawn 完就退出」，触发 launchd 的进程组连坐清扫
#   (AbandonProcessGroup 默认 false ⇒ 主进程退出时同组残留进程一律 SIGKILL)。
#   历史事故：旧 seeder-daemon.sh 用 nohup+disown 后台拉起再 exit，
#   nohup 只挡 SIGHUP、disown 只改 bash 作业表，都拦不住 launchd 的定向 SIGKILL，
#   于是「拉起 1132 次 / 只活到打印 banner 3 次」的自杀式死循环。
#
# 另一半职责：保证 .next 是 RUNTIME=node(libsql) 产物。driver 在 build 期定死，
#   若被 `npm run build`(Cloudflare/d1) 覆盖，next start 会命中 workerd 代理 →
#   /api/mcp 返回 500 + ECONNREFUSED 僵尸态。用 marker 文件比对 BUILD_ID 检测。
set -u

REPO="$HOME/Dev/jhfnetboy/goutou"
PORT=7399
MARKER="$REPO/.next/.node-build-marker"
BUILDING="$REPO/.seeder-building"   # 构建中标记，watchdog 据此避让

# launchd 环境 PATH 极简；探测可用 node 而非硬编码某个 nvm 版本
NODE_BIN=""
for d in /Users/jason/.nvm/versions/node/v22.22.2/bin \
         /Users/jason/.nvm/versions/node/*/bin \
         /opt/homebrew/bin /usr/local/bin; do
  [ -x "$d/node" ] && { NODE_BIN="$d"; break; }
done
export PATH="${NODE_BIN:+$NODE_BIN:}/Users/jason/Library/pnpm:/usr/local/bin:/opt/homebrew/bin:/usr/sbin:/usr/bin:/bin:/sbin"

ts() { date '+%F %T'; }
log() { echo "[$(ts)] [run] $*"; }

cd "$REPO" || { log "❌ 找不到仓库 $REPO"; sleep 30; exit 1; }

if [ -z "$NODE_BIN" ]; then
  log "❌ 找不到 node 可执行文件，退避 60s"
  sleep 60; exit 1
fi
log "使用 node: $(command -v node) ($(node -v 2>/dev/null))"

# ---- 保证是 node(libsql) 构建产物 ----
cur_build=$(cat "$REPO/.next/BUILD_ID" 2>/dev/null || echo "")
marked=$(cat "$MARKER" 2>/dev/null || echo "")
if [ -z "$cur_build" ] || [ "$cur_build" != "$marked" ]; then
  log "产物非 node 构建 (BUILD_ID=${cur_build:-none} marker=${marked:-none}) → npm run build:node"
  # 落一个「正在构建」标记，watchdog 见到它就不判死、不 kickstart（否则会腰斩 build，
  # 留下半残 .next 逼下一轮重编译）。trap 保证异常/被杀时也清掉。
  # 不用 pgrep 探进程名：Next 会重写进程标题，`pgrep -f "next build"` 实测匹配不到。
  date +%s > "$BUILDING"
  trap 'rm -f "$BUILDING"' EXIT INT TERM
  if npm run build:node; then
    new_build=$(cat "$REPO/.next/BUILD_ID" 2>/dev/null || echo "")
    if [ -n "$new_build" ]; then
      echo "$new_build" > "$MARKER"
      rm -f "$BUILDING"; trap - EXIT INT TERM
      log "✅ build:node 完成 BUILD_ID=$new_build"
    else
      log "❌ build 后仍无 BUILD_ID，退避 120s 后由 launchd 重试"
      rm -f "$BUILDING"
      sleep 120; exit 1
    fi
  else
    # 构建失败别让 KeepAlive 疯狂空转，睡够再退出让 launchd 重来
    log "❌ build:node 失败，退避 120s 后由 launchd 重试"
    rm -f "$BUILDING"
    sleep 120; exit 1
  fi
fi

# ---- 清理端口上的残留监听（上一实例未死透 / 手工启动的实例）----
stale=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null)
if [ -n "$stale" ]; then
  # 排除自己（本脚本还没 exec 成 next，不会占端口，但保险起见）
  log "端口 $PORT 有残留监听 pid: $stale → 清理"
  kill -9 $stale 2>/dev/null
  sleep 2
fi

# ---- 注入运行时环境 ----
# next start 不读 .dev.vars（那是 wrangler 的），显式 source 进来
set -a; source ./.dev.vars 2>/dev/null; set +a
export RUNTIME=node
export NODE_ENV=production
export SQLITE_DB_PATH="$REPO/data/seeder.db"
export PORT="$PORT"
export BETTER_AUTH_URL="http://localhost:$PORT"

log "启动 Seeder: RUNTIME=node next start -p $PORT (exec, 由 launchd 监管)"
# exec：本进程被 next 替换 ⇒ launchd 监管的就是 next 本身
exec "$REPO/node_modules/.bin/next" start -p "$PORT"
