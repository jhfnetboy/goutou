#!/bin/bash
# 把 Seeder 保活从 LaunchAgent(登录后才跑) 迁移到 LaunchDaemon(开机即跑)。
# 幂等：可重复执行。必须以 root 运行 —— 写 /Library/LaunchDaemons 和操作 system 域要特权。
#
#   sudo bash scripts/install-daemons.sh
#
# 注意：daemon 本身以 UserName=jason 运行（见 plist 注释），root 只用于「安装」这一步。
set -euo pipefail

TARGET_USER="jason"
REPO="/Users/$TARGET_USER/Dev/jhfnetboy/goutou"
SRC="$REPO/launchd/daemons"
DST="/Library/LaunchDaemons"
JOBS=(com.goutou.seeder com.goutou.seeder-watchdog)

[ "$(id -u)" -eq 0 ] || { echo "❌ 需要 root：sudo bash $0"; exit 1; }
UID_T=$(id -u "$TARGET_USER")
GID_T=$(id -g "$TARGET_USER")

echo "── 1/5 卸载旧的 LaunchAgent（用户域，登录才跑）"
for j in "${JOBS[@]}"; do
  launchctl bootout "gui/$UID_T/$j" 2>/dev/null && echo "   已卸载 agent $j" || echo "   agent $j 未挂载，跳过"
  old="/Users/$TARGET_USER/Library/LaunchAgents/$j.plist"
  [ -f "$old" ] && { mv -f "$old" "$old.migrated-to-daemon"; echo "   旧 plist 已备份为 $(basename "$old").migrated-to-daemon"; }
done

echo "── 2/5 卸载同名旧 daemon（幂等重装）"
for j in "${JOBS[@]}"; do
  launchctl bootout "system/$j" 2>/dev/null && echo "   已卸载 daemon $j" || true
done

echo "── 3/5 预建日志/状态文件，属主归 $TARGET_USER"
# daemon 以 jason 身份跑，但 launchd 打开 StandardOutPath 的时机在降权之前；
# 预先建好并 chown，避免生成 root 属主的日志导致服务进程写不进去。
for f in .seeder-server.log .seeder-watchdog.log .seeder-watchdog-health.log; do
  touch "$REPO/$f"
  chown "$UID_T:$GID_T" "$REPO/$f"
  chmod 644 "$REPO/$f"
done
# 历史遗留的 root 属主文件一并纠正
for f in .seeder-daemon.state .seeder-building .seeder-dev.log; do
  [ -e "$REPO/$f" ] && chown "$UID_T:$GID_T" "$REPO/$f" || true
done

echo "── 4/5 安装 plist 到 $DST（root:wheel 644，launchd 强制要求）"
for j in "${JOBS[@]}"; do
  install -m 644 -o root -g wheel "$SRC/$j.plist" "$DST/$j.plist"
  echo "   $DST/$j.plist"
done

echo "── 5/5 挂载到 system 域"
for j in "${JOBS[@]}"; do
  launchctl bootstrap system "$DST/$j.plist"
  echo "   已挂载 $j"
done

echo
echo "✅ 完成。当前状态："
launchctl list | grep -E "com\.goutou" || true
