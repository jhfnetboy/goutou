#!/bin/bash
# 把 Seeder 保活从 LaunchAgent(登录后才跑) 迁移到 LaunchDaemon(开机即跑)。
# 幂等：可重复执行。必须以 root 运行 —— 写 /Library/LaunchDaemons 和操作 system 域要特权。
#
#   sudo bash scripts/install-daemons.sh
#
# daemon 本身以 UserName=jason 运行（见 plist 注释），root 只用于「安装」这一步。
#
# ⚠️ 中文日志里的变量一律写 ${VAR} 而不是 $VAR。
#   bash 判定变量名用 locale 相关的 isalnum()，UTF-8 下全角标点（如「（」U+FF08）
#   的首字节会被当成名字的一部分 —— `$DST（…` 会去找并不存在的变量 `DST\xef…`，
#   在 set -u 下直接中止脚本。2026-08-31 本脚本就是这样在 3/5 步炸掉的。
#
# ⚠️ 顺序即安全。上一版先卸载 agent 再装 daemon，中途一失败就没人管服务了
#   （实际发生过：agent 已卸载、daemon 未装，Seeder 直接下线且无人拉起）。
#   现在改为：先做完所有【非破坏性】准备 → 才动 agent → 装不上立刻回滚。
set -euo pipefail

TARGET_USER="jason"
REPO="/Users/${TARGET_USER}/Dev/jhfnetboy/goutou"
SRC="${REPO}/launchd/daemons"
DST="/Library/LaunchDaemons"
AGENTS="/Users/${TARGET_USER}/Library/LaunchAgents"
PORT=7399
JOBS=(com.goutou.seeder com.goutou.seeder-watchdog)

[ "$(id -u)" -eq 0 ] || { echo "❌ 需要 root：sudo bash $0"; exit 1; }
id "${TARGET_USER}" >/dev/null 2>&1 || { echo "❌ 用户 ${TARGET_USER} 不存在"; exit 1; }
UID_T=$(id -u "${TARGET_USER}")
GID_T=$(id -g "${TARGET_USER}")

AGENTS_TOUCHED=0   # 是否已执行破坏性步骤（决定要不要回滚）

rollback() {
  [ "${AGENTS_TOUCHED}" -eq 1 ] || { echo "（未动过 agent，无需回滚）"; return 0; }
  echo
  echo "⚠️ 安装失败 —— 回滚到 LaunchAgent，保证 Seeder 不会无人监管"
  for j in "${JOBS[@]}"; do
    launchctl bootout "system/${j}" 2>/dev/null || true
    if [ -f "${AGENTS}/${j}.plist.migrated-to-daemon" ]; then
      mv -f "${AGENTS}/${j}.plist.migrated-to-daemon" "${AGENTS}/${j}.plist"
    fi
    [ -f "${AGENTS}/${j}.plist" ] && launchctl bootstrap "gui/${UID_T}" "${AGENTS}/${j}.plist" 2>/dev/null || true
  done
  echo "   已回滚。服务应在数秒内恢复，用下面这条确认："
  echo "   lsof -iTCP:${PORT} -sTCP:LISTEN"
}
trap rollback ERR

echo "── 1/6 预检（不改动任何东西）"
for j in "${JOBS[@]}"; do
  [ -f "${SRC}/${j}.plist" ] || { echo "❌ 缺少 ${SRC}/${j}.plist"; exit 1; }
  plutil -lint "${SRC}/${j}.plist" >/dev/null || { echo "❌ ${j}.plist 格式非法"; exit 1; }
done
for f in scripts/seeder-run.sh scripts/seeder-daemon.sh; do
  [ -f "${REPO}/${f}" ] || { echo "❌ 缺少 ${REPO}/${f}"; exit 1; }
  bash -n "${REPO}/${f}" || { echo "❌ ${f} 语法错误，拒绝安装"; exit 1; }
done
echo "   plist 合法、脚本语法通过"

echo "── 2/6 预建日志/状态文件，属主归 ${TARGET_USER}"
# daemon 以 jason 身份跑，但 launchd 打开 StandardOutPath 在降权之前；
# 预先建好并 chown，避免生成 root 属主的日志导致服务进程写不进去。
for f in .seeder-server.log .seeder-watchdog.log .seeder-watchdog-health.log; do
  touch "${REPO}/${f}"
  chown "${UID_T}:${GID_T}" "${REPO}/${f}"
  chmod 644 "${REPO}/${f}"
done
for f in .seeder-daemon.state .seeder-building .seeder-dev.log; do
  [ -e "${REPO}/${f}" ] && chown "${UID_T}:${GID_T}" "${REPO}/${f}" || true
done

echo "── 3/6 安装 plist 到 ${DST}"
# root:wheel 644 是 launchd 的硬性要求，属主/权限不对会拒绝加载
for j in "${JOBS[@]}"; do
  install -m 644 -o root -g wheel "${SRC}/${j}.plist" "${DST}/${j}.plist"
  echo "   ${DST}/${j}.plist"
done

echo "── 4/6 卸载旧 daemon（幂等重装）与旧 LaunchAgent"
AGENTS_TOUCHED=1   # 从这里开始，失败必须回滚
for j in "${JOBS[@]}"; do
  launchctl bootout "system/${j}" 2>/dev/null || true
done
for j in "${JOBS[@]}"; do
  launchctl bootout "gui/${UID_T}/${j}" 2>/dev/null && echo "   已卸载 agent ${j}" || echo "   agent ${j} 未挂载，跳过"
  if [ -f "${AGENTS}/${j}.plist" ]; then
    mv -f "${AGENTS}/${j}.plist" "${AGENTS}/${j}.plist.migrated-to-daemon"
    echo "   旧 plist 备份为 ${j}.plist.migrated-to-daemon"
  fi
done

echo "── 5/6 挂载到 system 域"
for j in "${JOBS[@]}"; do
  launchctl bootstrap system "${DST}/${j}.plist"
  echo "   已挂载 ${j}"
done

echo "── 6/6 验证服务真的起来了（最多等 180s，首次可能要 build:node）"
ok=0
for i in $(seq 1 36); do
  sleep 5
  if lsof -tiTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then ok=1; break; fi
done
if [ "${ok}" -ne 1 ]; then
  echo "❌ ${PORT} 端口在 180s 内没起来"
  rollback
  trap - ERR
  exit 1
fi
trap - ERR

echo
echo "✅ 迁移完成。当前状态："
launchctl list | grep -E "com\.goutou" || true
lsof -iTCP:${PORT} -sTCP:LISTEN -n -P | tail -1
echo
echo '提示：计划内重启用  sudo fdesetup authrestart  可穿透 FileVault 解锁界面。'
