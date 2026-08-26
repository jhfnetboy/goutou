# Goutou 运维手册（OPS）

commander 机器上跑着三个 launchd 任务:**Seeder 服务本体**(`com.goutou.seeder`,KeepAlive 常驻)、**Seeder 健康 watchdog**(`com.goutou.seeder-watchdog`,每 60s 探活)和 **Codex reaper**(清 codex 泄漏)。本文是它们的故障排查 + 复现指南。

---

## 1. Seeder 保活（launchd 直接监管 + 健康 watchdog）

Seeder(端口 **7399**)以 `RUNTIME=node` + libsql 常驻。**两个 launchd 任务分工**:

| 任务 | 角色 | 触发 |
|---|---|---|
| `com.goutou.seeder` | **服务本体**。`scripts/seeder-run.sh` 结尾 `exec` 进 `next start`,前台常驻,launchd 用 `KeepAlive` 直接监管 —— 进程一死秒级拉回 | `RunAtLoad` + `KeepAlive` |
| `com.goutou.seeder-watchdog` | **健康检查器**。只探 HTTP、**绝不自己 spawn 进程**;判死后 `launchctl kickstart -k` 把重启动作交回 launchd | `StartInterval=60` |

- 脚本:`scripts/seeder-run.sh`(启动器) / `scripts/seeder-daemon.sh`(健康检查)
- launchd:`~/Library/LaunchAgents/com.goutou.seeder.plist` / `com.goutou.seeder-watchdog.plist`
- 状态:`.seeder-daemon.state`(存 `last_restart`/`fails`)、`.next/.node-build-marker`(node 产物指纹)、`.seeder-building`(构建中标记) —— 均 gitignored
- launchd plist 副本随仓库分发:`launchd/`(换机器时改里面的绝对路径再 `cp` 到 `~/Library/LaunchAgents/`)
- 日志:`.seeder-server.log`(服务本体) / `.seeder-watchdog-health.log`(健康事件,健康时为空)

### 健康判据
带**真 PAT** 打 `/api/mcp` initialize —— **只有 200** 才算 DB 真活着(解析 PAT 要查库)。
无 auth 探测(→401)不碰 DB,僵尸 500 时仍返回 401 → 会误判健康,**不可用**。

### 历史事故根因 A：守护进程杀死自己拉起的服务（2026-08-26 定位并修复）
**症状**:服务反复「暂停死掉」,watchdog 看似在跑却毫无用处。日志实测 **拉起 1132 次,只有 3 次活到打印启动 banner**。

**根因**:旧 `seeder-daemon.sh` 用 `nohup next start &` + `disown` 后台拉起,然后立刻 `exit 0`。
launchd 的 **`AbandonProcessGroup` 默认 `false`** —— 语义是「job 主进程退出时,同进程组里残留的进程一律 SIGKILL」。
`nohup` 只挡 SIGHUP、`disown` 只改 bash 的作业表,**两者都拦不住 launchd 的定向击杀**。
于是脚本 spawn 完几毫秒就退出 → launchd 当场灭掉刚生出来的 Next → 60s 后再拉、再被灭,死循环。

**修复**:服务本体交给独立的 `com.goutou.seeder` job 前台 `exec` 运行,launchd 监管的就是 Next 进程本身;
watchdog 降级为纯健康检查器,重启一律走 `launchctl kickstart -k`,不再持有任何服务进程。

> 通用教训:**launchd 任务里不要后台 spawn 长驻进程**。要么让 job 自己前台跑那个进程(`exec` + `KeepAlive`),
> 要么显式设 `AbandonProcessGroup=true`。前者更好 —— 崩溃重启、日志、状态都由 launchd 统一管。

### 历史事故根因 B：Cloudflare 产物覆盖导致僵尸 500
某次 `npm run build`(发布用)把 `.next` 覆盖成 **Cloudflare 产物**(打进 d1 driver)。
driver 在 **build 期**定死,运行时才 `export RUNTIME=node` 已**太晚** → 每个请求去连早已死掉的 workerd D1 代理
(`ECONNREFUSED 127.0.0.1:<随机端口>` / `MessagePort worker(eval)`)→ 500 僵尸态。

**现在的闭环**:`seeder-run.sh` 启动前比对 `.next/BUILD_ID` 与 `.next/.node-build-marker`,不一致就先 `build:node` 再起;
watchdog 探到 **5xx** 时主动删掉 marker 再 kickstart,强制重建。改 Seeder 代码或发布后仍建议手动 `npm run build:node`。

### 防「渣」设计
| 防护 | 作用 |
|---|---|
| **KeepAlive + ThrottleInterval=10s** | 服务崩了秒级拉回;两次启动最小间隔 10s,防 boot-crash 刷爆 |
| **build 失败退避 120s** | `build:node` 失败时脚本 `sleep 120` 再退出,避免 `KeepAlive` 疯狂空转重编译 |
| **启动宽限 GRACE=90s** | 刚 kickstart 的实例不判死,给 boot 时间;state 缺失时 `last_restart` 初始化为「此刻」,首轮同样享受宽限 |
| **构建避让(标记文件)** | `seeder-run.sh` 构建期间落 `.seeder-building`(带时间戳,`trap` 保证异常也清),watchdog 见到就**直接放行不 kickstart**。超 `BUILD_GRACE=420s` 视为 stale 残留。**不用 `pgrep -f "next build"`** —— Next 会重写进程标题,实测匹配不到,2026-08-26 演练中因此腰斩过一次构建,逼得 build 跑了两遍 |
| **失败退避** | 连续 `MAXFAILS=4` 次 kickstart 仍不健康 → 改成每 `BACKOFF=600s` 才试一次并大声记日志 |
| **日志轮转 2MB** | watchdog 每轮检查 `.seeder-server.log` / 健康日志大小,超阈值转存 `.1`,防吃满磁盘 |
| **node 路径探测** | 不再硬编码某个 nvm 版本;按序探测 v22.22.2 → 任意 nvm 版本 → homebrew |
| **未挂载自愈** | watchdog 发现 `com.goutou.seeder` 没挂载会自动 `bootstrap` 回去 |

### ⚠️ LaunchAgent 的固有边界
`LaunchAgent` **只在用户登录后运行**。Mac 重启但停在登录界面 → Seeder 不会起。
要真 24/7,需开「系统设置 → 用户与群组 → 自动登录」,或改用 `LaunchDaemon`(root,`/Library/LaunchDaemons`)。
睡眠不影响:唤醒后进程仍在;若被系统回收,`KeepAlive` 会拉回。

### 管理命令
```bash
# 状态(两个 job 都看)
launchctl list | grep goutou
launchctl print gui/$(id -u)/com.goutou.seeder | grep -E "state|pid|runs|last exit"

# 服务本体:重启 / 停 / 起
launchctl kickstart -k gui/$(id -u)/com.goutou.seeder
launchctl bootout    gui/$(id -u)/com.goutou.seeder
launchctl bootstrap  gui/$(id -u) ~/Library/LaunchAgents/com.goutou.seeder.plist

# watchdog:同样三件套(把 com.goutou.seeder 换成 com.goutou.seeder-watchdog)
launchctl kickstart gui/$(id -u)/com.goutou.seeder-watchdog   # 立刻跑一次健康检查

# 看日志
tail -f ~/Dev/jhfnetboy/goutou/.seeder-server.log            # 服务本体
tail -f ~/Dev/jhfnetboy/goutou/.seeder-watchdog-health.log   # 健康事件(健康时为空)

# 手动健康检查
PAT=$(node -e "const c=require(process.env.HOME+'/.claude.json');process.stdout.write((c.mcpServers.seeder.headers.Authorization||'').replace(/^Bearer\s+/i,''))")
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://localhost:7399/api/mcp \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}'

# 强制重建 node 产物(僵尸 500 时的手动版)
rm -f ~/Dev/jhfnetboy/goutou/.next/.node-build-marker
launchctl kickstart -k gui/$(id -u)/com.goutou.seeder
```

---

## 2. Codex reaper（清 codex 泄漏）

### 问题
Codex 审查(review Tier1)每次调用 spawn 一条**三层链**,后两层从不回收:
```
app-server-broker.mjs (node broker)  →  codex app-server (native)  →  mcp/server.cjs --stdio (桥接)
```
一两周攒到数百个、几个 G 内存(事故:221 app-server + 153 桥接 ≈ **9GB**),全 0% CPU 闲置,挤爆内存会**间接害 Seeder 崩**。**与 seeder-daemon 无关**,单列此 reaper。

### 方案
- 脚本:`scripts/codex-reaper.sh`
- launchd:`~/Library/LaunchAgents/com.goutou.codex-reaper.plist`(`RunAtLoad` + `StartInterval=1800`,每 30 分钟)
- 日志:`.codex-reaper.log`

**安全判据**(宁可漏杀,不可错杀正在跑的审查):
- **`codex app-server`(native 层)**:只杀「存活 > `MIN_AGE=1800s`(30 分钟) **且** 累计 CPU < `MAX_CPU=60s`」—— 活了很久却几乎没干活 = 僵。刚 spawn 的活审查年龄不够、跑过活的 CPU 够高,都不碰。
  **且排除 `/Applications/Codex.app/` 桌面版后台**——桌面版常年存活、低 CPU,会误命中 age+cpu 判据被 SIGKILL,破坏用户的 Codex 桌面 App。
- **`mcp/server.cjs`(桥接层)**:只杀 **ppid=1 孤儿**(父 app-server 死了才会变孤儿)。

> **broker 层不碰**:broker 由插件以 `detached`(`unref`)方式 spawn,**`ppid=1` 是它的设计稳态而非孤儿信号**;插件按 **cwd** 复用存活 broker(探 unix socket,不看 ppid),用 ppid 判据会误杀正在被复用的活 broker。安全回收 broker 需探 socket 存活性 + 走插件自带的优雅关闭,属**未来工作**,当前一律不动 broker。

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
