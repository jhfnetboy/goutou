#!/bin/bash
# Codex 泄漏 reaper。由 launchd 每 30 分钟调用一次，也可手动跑。
#
# 背景：Codex 审查(Tier1 review)每次调用 spawn 一个 `codex app-server` + 若干
# `mcp/server.cjs --stdio` 桥接子进程，从不回收。一两周攒到数百个、几个 G 内存，
# 全部 0% CPU 闲置，还会挤爆内存间接害 Seeder。seeder-daemon 不管这个，单列此 reaper。
#
# 安全判据（宁可漏杀，不可错杀正在跑的审查）：
#   只杀「存活 > MIN_AGE 秒」且「累计 CPU 时间 < MAX_CPU 秒」的 app-server —— 即活了很久
#   却几乎没干过活 = 泄漏的僵进程。刚 spawn 的（活审查）年龄不够，不杀；跑过活的 CPU
#   够高，不杀。app-server 杀掉后，其 mcp/server.cjs 桥接子进程会变孤儿(ppid=1)，再清孤儿。
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

# 选出「老 + 几乎没跑过活」的 codex app-server pid
pids=$(ps -axo etime=,cputime=,pid=,command= | awk -v minage="$MIN_AGE" -v maxcpu="$MAX_CPU" '
  /codex app-server/ {
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

# 清理因父进程被杀而变孤儿(ppid=1)的桥接进程；仍挂在活 codex 下的不动
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
