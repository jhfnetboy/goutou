#!/bin/bash
# Codex 泄漏 reaper。由 launchd 每 30 分钟调用一次，也可手动跑。
#
# 背景：Codex 审查(Tier1 review)每次调用 spawn 一条泄漏链：
#   app-server-broker.mjs (node broker) → codex app-server (native) → mcp/server.cjs --stdio (桥接)
# 后两层从不回收，一两周攒到数百个、几个 G 内存，全部 0% CPU 闲置，还会挤爆内存间接害 Seeder。
# 本 reaper 收其中两层：
#   - codex app-server：按「老 + 几乎没跑过活」判据（仅限插件/CLI spawn 的，见下）。
#   - mcp/server.cjs 桥接：按 ppid=1 孤儿判据（父 app-server 死了才会变孤儿）。
#
# ⚠️ 不碰 broker 层：broker 由插件以 detached(unref) 方式 spawn，ppid=1 是它的**设计稳态**
#   而非孤儿信号；且插件按 **cwd** 复用存活 broker（探 unix socket，不看 ppid）。用 ppid 判据
#   会 kill 掉正在被复用的活 broker。要安全回收 broker 必须探它的 socket 存活性 + 走插件自己的
#   优雅关闭，属未来工作，本脚本一律不动 broker。
#
# ⚠️ 只杀「插件/CLI spawn 的」codex app-server，**排除 /Applications/Codex.app/ 桌面版后台**——
#   桌面版后台常年存活、低 CPU，会误命中 age+cpu 判据被 SIGKILL，破坏用户的 Codex 桌面 App。
#
# 注意：macOS ps 用 etime（格式 [[dd-]hh:]mm:ss），无 Linux 的 etimes(秒)。用 awk 解析。
set -u

export PATH="/Users/jason/.nvm/versions/node/v22.22.2/bin:/usr/local/bin:/opt/homebrew/bin:/usr/sbin:/usr/bin:/bin:/sbin"

REPO="$HOME/Dev/jhfnetboy/goutou"
LOG="$REPO/.codex-reaper.log"
MIN_AGE=1800     # 秒：存活超过 30 分钟才考虑
MAX_CPU=60       # 秒：累计 CPU 时间低于 60s = 基本没干活 = 僵

ts() { date '+%F %T'; }
log() { echo "[$(ts)] $*" >> "$LOG"; }

# 选出「老 + 几乎没跑过活」的插件/CLI codex app-server pid（排除 Codex.app 桌面版）
pids=$(ps -axo etime=,cputime=,pid=,command= | awk -v minage="$MIN_AGE" -v maxcpu="$MAX_CPU" '
  /codex app-server/ && $0 !~ /Applications\/Codex\.app/ {
    etime=$1; cputime=$2; pid=$3
    # etime → 秒：[[dd-]hh:]mm:ss
    d=0; rest=etime
    if (index(etime,"-")>0) { split(etime,a,"-"); d=a[1]; rest=a[2] }
    n=split(rest,t,":"); es=0
    for (i=1;i<=n;i++) es=es*60+t[i]
    es += d*86400
    # cputime → 秒：[[hh:]mm:]ss.frac
    n2=split(cputime,c,":"); cs=0
    for (i=1;i<=n2;i++) cs=cs*60+c[i]
    if (es > minage && cs < maxcpu) print pid
  }')

killed_srv=0
for pid in $pids; do
  kill -9 "$pid" 2>/dev/null && killed_srv=$((killed_srv + 1))
done

sleep 2

# 清理因父进程(app-server)被杀而变孤儿(ppid=1)的桥接进程；仍挂在活 app-server 下的不动
killed_bridge=0
for pid in $(pgrep -f "mcp/server.cjs --stdio"); do
  ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  if [ "${ppid:-0}" = "1" ]; then
    kill -9 "$pid" 2>/dev/null && killed_bridge=$((killed_bridge + 1))
  fi
done

if [ "$killed_srv" -gt 0 ] || [ "$killed_bridge" -gt 0 ]; then
  log "清理闲置 codex: app-server ${killed_srv} 个, 孤儿桥接 ${killed_bridge} 个"
fi
exit 0
