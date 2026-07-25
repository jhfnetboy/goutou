# Goutou 运维手册（OPS）

commander 机器上跑着两个 launchd 常驻任务:**Seeder watchdog**(保活协同中枢)和 **Codex reaper**(清 codex 泄漏)。本文是它们的故障排查 + 复现指南。

---

## 1. Seeder watchdog（服务保活）

Seeder(端口 **7399**)以 `RUNTIME=node` + libsql 常驻。watchdog 每 60s 健康检查,挂了自动重启。

- 脚本:`scripts/seeder-daemon.sh`
- launchd:`~/Library/LaunchAgents/com.goutou.seeder-watchdog.plist`(`RunAtLoad` + `StartInterval=60`)
- 状态:`.seeder-daemon.state`(gitignored,存 `last_restart` / `fails` / `node_build_id`)
- 日志:`.seeder-dev.log`(应用 + 重启)、`.seeder-watchdog.log`(launchd)

### 健康判据
带**真 PAT** 打 `/api/mcp` initialize —— **只有 200** 才算 D1 真活着(解析 PAT 要查 D1)。
无 auth 探测(→401)不碰 D1,僵尸 500 时仍返回 401 → 会误判健康,**不可用**。

### 三个防「渣」设计（2026-07-24 修 boot-crash 死循环）
| 防护 | 作用 |
|---|---|
| **① ensure_node_build** | driver 在 **build 时**按 `RUNTIME` 打包(`build:node`=libsql / 普通 `build`=d1)。若 `.next/BUILD_ID` ≠ 记录的 node 构建 id(被 `npm run build` 覆盖成 Cloudflare 产物)→ 先 `build:node` 重建再拉起 |
| **② 启动宽限 GRACE=45s** | 刚(重)启的实例 45s 内不判死不重杀,给 boot 时间 |
| **③ 失败退避** | 连续 `MAXFAILS=4` 次拉起仍不健康 → 改成每 `BACKOFF=600s` 才试一次并大声记日志,不再每 60s 锤 |

### 历史事故根因（必读）
某次 `npm run build`(发布用)把 `.next` 覆盖成 **Cloudflare 产物**(打进 d1 driver)。watchdog 用 `next start` + 运行时才 `export RUNTIME=node` —— **太晚**,d1 分支已进 bundle → 每个请求去连早已死掉的 workerd D1 代理(`ECONNREFUSED 127.0.0.1:<随机端口>` / `MessagePort worker(eval)`)→ 500 → 判死 → 每 60s 杀了重拉 → 拉起又崩,死循环。
**教训**:改 Seeder 代码或发布后,务必 `npm run build:node` 重建 node 产物;watchdog 的 ensure_node_build 现在会自动纠正。

### 管理命令
```bash
# 状态
launchctl list | grep seeder-watchdog
# 停用 / 重载
launchctl bootout   gui/$(id -u)/com.goutou.seeder-watchdog
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.goutou.seeder-watchdog.plist
# 手动跑一次
bash ~/Dev/jhfnetboy/goutou/scripts/seeder-daemon.sh
# 手动健康检查
PAT=$(node -e "const c=require(process.env.HOME+'/.claude.json');process.stdout.write((c.mcpServers.seeder.headers.Authorization||'').replace(/^Bearer\s+/i,''))")
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://localhost:7399/api/mcp \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}'
```

---

## 2. Codex reaper（清 codex 泄漏）

### 问题
Codex 审查(review Tier1)每次调用 spawn 一个 `codex app-server` + 若干 `mcp/server.cjs --stdio` 桥接子进程,**从不回收**。一两周攒到数百个、几个 G 内存(事故:221 app-server + 153 桥接 ≈ **9GB**),全 0% CPU 闲置,挤爆内存会**间接害 Seeder 崩**。**与 seeder-daemon 无关**,单列此 reaper。

### 方案
- 脚本:`scripts/codex-reaper.sh`
- launchd:`~/Library/LaunchAgents/com.goutou.codex-reaper.plist`(`RunAtLoad` + `StartInterval=1800`,每 30 分钟)
- 日志:`.codex-reaper.log`

**安全判据**(宁可漏杀,不可错杀正在跑的审查):只杀「存活 > `MIN_AGE=1800s`(30 分钟) **且** 累计 CPU < `MAX_CPU=60s`」的 `codex app-server` —— 活了很久却几乎没干活 = 僵。刚 spawn 的活审查年龄不够、跑过活的 CPU 够高,都不碰。app-server 杀掉后其桥接子进程变孤儿(ppid=1),再清孤儿。

> macOS `ps` 用 `etime`(格式 `[[dd-]hh:]mm:ss`),无 Linux 的 `etimes`(秒);脚本用 awk 解析。

### 手动应急清理
```bash
# 全清(Codex GUI 没开 + 全闲置时安全)
pkill -9 -f "codex app-server"; pkill -9 -f "mcp/server.cjs --stdio"
# 只跑 reaper 的安全清理
bash ~/Dev/jhfnetboy/goutou/scripts/codex-reaper.sh
# 看现状
echo "app-server: $(pgrep -f 'codex app-server' | wc -l) | 桥接: $(pgrep -f 'mcp/server.cjs' | wc -l)"
```

### 在其他机器复现（若那台也跑 codex 审查）
```bash
# 1. 脚本已随仓库分发(scripts/codex-reaper.sh),确认路径 / PATH 里的 node 版本对得上
# 2. 装 launchd(改 plist 里的绝对路径为该机仓库路径)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.goutou.codex-reaper.plist
launchctl list | grep codex-reaper
```

> **plist 不入仓库**(与 seeder-watchdog plist 一致,只在 `~/Library/LaunchAgents`)。换机器需手写 plist,内容见本仓库 git 历史或照 seeder-watchdog plist 改。

---

## PATH 注意（两个脚本共通）
launchd 环境 PATH 极简,脚本里**硬编码**了 node(nvm)/pnpm 路径:
`/Users/jason/.nvm/versions/node/v22.22.2/bin` + `/Users/jason/Library/pnpm`。
**升级 node 版本后,要同步改两个脚本里的 PATH。**
