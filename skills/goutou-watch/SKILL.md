---
name: goutou-watch
description: 狗头守夜 — goutou 主控仓库的持续监控循环。同步各生态仓库的 Release/Breaking Change/接口变更到 Seeder，并触发收敛检查。配合 /loop /goutou-watch 实现 24/7 不间断运行。触发词：/goutou-watch、"开始监控"、"启动守夜"。
---

# 狗头守夜 / Goutou Watch

goutou 主控仓库的核心守夜循环。每轮执行：同步检测 → 变化通知 → 收敛检查 → 更新状态。

## 激活时机

- `/loop /goutou-watch` — 启动持续监控（推荐，进入 goutou 仓库后执行一次）
- `/goutou-watch` — 单次手动执行一轮

## 模型路由策略（节省 token）

```
Haiku（当前 session 模型，推荐用于本 skill）
  ├─ Step 0  读配置/state 文件
  ├─ Step 1  gh release list 扫描（机械比对）
  ├─ Step 3  Brood 文件时间戳检查
  ├─ Step 7  写 state 文件
  └─ Step 8  输出摘要

Sonnet 子 Agent（spawn Agent tool，model="sonnet"）
  ├─ Step 2  分析 commit log，判断 breaking change 类型
  └─ Step 5d 生成 Seeder 通知评论（影响分析 + 建议）
```

**启动方式（最省钱）**：
```bash
/model haiku     # 先切换到 Haiku
/loop /goutou-watch
```

Step 2 和 Step 5d 中，遇到需要理解内容的情况，用 Agent 工具指定 `model: "sonnet"` 的子 agent 处理，结果返回后继续。

## 前置条件

- 当前目录为 goutou 仓库（`~/Dev/jhfnetboy/goutou`）
- `seeder` MCP 已配置（readwrite PAT）
- `gh` CLI 已登录（`gh auth status`）
- `~/Dev/Brood/` 存在（生态大脑，依赖图和状态来源）

---

## 工作流

### Step 0：加载配置和状态

```bash
# 读 goutou 配置
cat .goutou.json 2>/dev/null || echo "{}"

# 读依赖图（本仓库权威源）
cat .goutou-deps.json

# 读上次状态（dedup 用）
cat .goutou-watch-state.json 2>/dev/null || echo '{"lastCheck":"","repos":{},"notified":[]}'

# 读 Brood 生态健康状态（仓库活跃度）
cat ~/Dev/Brood/docs/REPO_STATUS.md | head -150
```

从 `coordProjectId` 定位协同中枢，从 `repos{}` 读各仓库上次已知 release。

### Step 1：Release 扫描（拉取）

对 `.goutou-deps.json` 中的每个 repo，若本地路径存在（`[ -d ~/Dev/<path> ]`），执行：

```bash
# 获取最新 release tag
gh release list --repo <github> --limit 1 --json tagName,publishedAt,isPrerelease 2>/dev/null
```

对比 `.goutou-watch-state.json` 中存储的 `lastRelease`：

- **相同** → 跳过（无变化，节省 token）
- **不同或首次** → 进入 Step 2 分析

若 `gh release list` 无输出，改用 git tag：
```bash
git -C ~/Dev/<localPath> describe --tags --abbrev=0 2>/dev/null
```

### Step 2：变化类型分析

对有新 release 的仓库：

**2a. 判断是否 Breaking Change**

```bash
# 方法1：commit message 关键词
git -C ~/Dev/<localPath> log <oldTag>..<newTag> --oneline 2>/dev/null \
  | grep -iE "(\!:|BREAKING CHANGE|breaking:)"

# 方法2：GitHub PR labels（若有 breaking-change label）
gh pr list --repo <github> --state merged --label "breaking-change" \
  --json number,title,mergedAt --limit 5 2>/dev/null
```

**2b. 判断变化类型**（结合 `changeTypes` 字段）

| 变化 | 判断依据 |
|---|---|
| New Release | 有新 tag，非 BREAKING |
| Breaking Change | commit 含 `!:` / `BREAKING CHANGE` / PR label `breaking-change` |
| 上下游建议 | Breaking Change + downstream 非空时自动触发 |

**2c. 读变更摘要**

```bash
# 尝试读 CHANGELOG
git -C ~/Dev/<localPath> show HEAD:CHANGELOG.md 2>/dev/null | head -50
# 或 release notes
gh release view <newTag> --repo <github> --json body 2>/dev/null
```

### Step 3：Brood 反向同步检测（推送通道）

读 Brood 的接口变更记录（Brood `/sync-context-reverse` 会更新此文件）：

```bash
# 检查 Brood 是否有新的接口变更记录（比 state 文件更新）
ls -la ~/Dev/Brood/orgs/aastar/INTERFACES.md \
       ~/Dev/Brood/orgs/auraai/INTERFACES.md \
       ~/Dev/Brood/orgs/mycelium/INTERFACES.md 2>/dev/null
```

若 INTERFACES.md 的修改时间比 state 文件中的 `lastBroodSync` 更新，读取变更内容：
```bash
git -C ~/Dev/Brood log --oneline --since="<lastBroodSync>" -- orgs/*/INTERFACES.md 2>/dev/null
```

这是 **推送通道**：Brood 检测接口变更后更新文件，goutou-watch 拉取感知。

### Step 4：路由影响范围

对每个有变化的 repo，从 `.goutou-deps.json` 读取 `downstream` 列表：

```
paymaster 发布 v5.5.0（breaking）
  → downstream: [aastar-sdk, idoris, launch]
  → 需通知仓库: aastar-sdk, idoris, launch
```

dedup：检查 state 文件的 `notified` 数组，若已有 `"<repoId>@<tag>"` → 跳过，不重复通知。

### Step 5：写入 Seeder 通知

对每个新变化，在协同中枢创建通知任务：

**5a. 确认标签存在**（repo:aastar-sdk 等）
调用 `list-task-labels`，缺失则 `create-task-label`（颜色从 `.goutou-deps.json` 的 `orgColors` 读取）

**5b. 创建通知任务**
```
title:       [变更通知] <repoId> → <newTag>
description: "repo:<downstream1> repo:<downstream2> type:<changeType>"
```

**5c. 打标签**：给所有受影响下游 repo 打 `repo:<id>` 标签

**5d. 写变更详情评论**
```markdown
## 变更来源

**repo:<repoId>** 发布 <newTag>（<日期>）
变更类型：<New Release / Breaking Change / 接口变更>

## 变更摘要

<从 CHANGELOG 或 release notes 提取的 2-5 条要点>

## 影响范围

| 仓库 | 受影响接口/功能 | 建议操作 |
|---|---|---|
| repo:aastar-sdk | npm upgrade + type check | 升级依赖、运行类型检查、测试集成 |
| repo:idoris | paymaster结算接口 | 确认新版 ABI 兼容性 |

## 上游信息

GitHub Release: <url>
Breaking commits: <若有，列出关键 commit>

---
*🐾 goutou-watch 自动检测 · <timestamp>*
```

### Step 5e：Agent dispatch（新模式）

每个新变化任务创建完成后，立即对下游仓库 **并行** spawn Agent（使用 Agent 工具）。

**复杂度判断**：

| 类型 | 判断条件 | Agent 行为 |
|---|---|---|
| 简单通知 | 无 BREAKING，patch/minor release | spawn Agent，直接发初步影响评估 comment |
| 复杂/架构 | BREAKING CHANGE，或 changeType 含 `architecture` | spawn Agent 发初稿 + 输出摘要行提示用户去各 repo 手动 /goutou |

**Agent prompt 模板**（简单通知类）：
```
你是 <repoId> 仓库的工兵，响应 Seeder 协同任务 <taskCode>。

工作目录：<localPath>（先读 CLAUDE.md 和 memory 文件）

任务背景：<repoId_upstream> 发布 <newTag>，变更摘要：<summary>

你需要评估的问题：
1. 本仓库是否依赖受影响的接口/功能？（grep 检查 import 和用法）
2. 需要什么操作（升级版本、修改调用、回归测试）？
3. 工作量估计

用 mcp__seeder__add-task-comment 在任务 <taskId>（projectId: <coordProjectId>）下发评论。

格式：
[repo:<repoId> 工兵响应]
## 影响评估
...
🐾 goutou-watch Agent dispatch · <timestamp>
```

**BREAKING/复杂任务额外输出**（在本轮摘要 Step 8 里追加）：
```
⚠️  复杂任务需人工深度响应：
   任务 <taskCode>：请去以下仓库手动跑 /goutou
   - <repo1>: cd <path> → 打开 Claude Code → /goutou
   - <repo2>: cd <path> → 打开 Claude Code → /goutou
```

**注意**：
- 若某仓库本地路径不存在（`[ -d <localPath> ]` 为假），跳过该仓库的 Agent dispatch，在摘要里说明
- Agent 并行 spawn，不等结果，本轮 watch 继续往下走

### Step 6：收敛检查

内联执行一次 `/goutou-converge` 的核心逻辑：

1. 调用 `list-tasks`（coordProjectId，verbose=true）找 `isTerminal=false` 的任务
2. 对每个任务，调用 `list-task-comments` 检查是否所有工兵都已回复
3. 完全收敛 → 发汇总评论 + 推进状态（逻辑同 goutou-converge Step 3）

若无收敛任务，静默跳过（不输出）。

### Step 7：更新状态文件

写入 `.goutou-watch-state.json`：

```json
{
  "lastCheck": "<ISO8601 timestamp>",
  "lastBroodSync": "<Brood INTERFACES.md 最新 commit 时间>",
  "quietRounds": 0,
  "repos": {
    "<repoId>": {
      "lastRelease": "<tag>",
      "lastReleaseAt": "<ISO8601>",
      "lastCheckAt": "<ISO8601>"
    }
  },
  "notified": [
    "<repoId>@<tag>",
    "<repoId>@brood-<commitHash>"
  ]
}
```

**`quietRounds` 更新规则**：
- 本轮有新变化（新 release / Brood 更新）→ 重置 `quietRounds = 0`
- 本轮无变化 → `quietRounds += 1`

### Step 8：输出本轮摘要，决定下次间隔

```
🐾 守夜巡逻完毕 <timestamp>

📦 Release 扫描：<n> 个仓库
   🆕 新发现：<m> 个变化（已写入 Seeder）
   ✅ 无变化：<k> 个
   ⏭️  已通知（跳过）：<j> 个

🤖 Agent dispatch：<已派发 x 个 / 无新任务>

🔗 Brood 接口同步：<有变更 / 无变更>

🧠 收敛检查：<x> 个任务完全收敛（已汇总）

⏰ 退避状态：quietRounds=<n>，下次间隔 <X 分钟 / 停止>
```

**自适应退避逻辑**（在输出摘要后执行）：

根据更新后的 `quietRounds` 决定下一步：

| quietRounds（更新后） | 动作 |
|---|---|
| 0、1、2 | `ScheduleWakeup(300s)` — 5 分钟，活跃监控 |
| 3 | `ScheduleWakeup(900s)` — 15 分钟，开始退避 |
| 4 | `ScheduleWakeup(1800s)` — 30 分钟 |
| 5 | `ScheduleWakeup(3600s)` — 1 小时 |
| ≥6 | **不调用 ScheduleWakeup** — loop 自然终止，输出「🛑 连续 6 轮无变化，守夜循环已停止。如需重启：/loop /goutou-watch」 |

> 有新变化时（quietRounds 重置为 0），下次自动恢复 5 分钟间隔。
> 用户可随时手动 `/loop /goutou-watch` 重启循环，quietRounds 从 state 文件读取（继续累计或已重置）。

---

## 与 /loop 配合

```bash
# 进入 goutou 仓库后执行一次，启动持续监控
/loop /goutou-watch
```

`/loop` 会在每轮结束后根据退避状态自动决定下次触发时间：
- 活跃期（有变化）：5 分钟
- 安静期：5 分钟 × 3 轮 → 15 分钟 → 30 分钟 → 1 小时 → 自动停止

重启方式：任意时刻再次执行 `/loop /goutou-watch`。

## 错误处理

- `gh` 未登录 → 跳过 GitHub 扫描，只做 Seeder 收敛检查，提示用户运行 `gh auth login`
- Brood 目录不存在 → 跳过 Step 3，仅做 Release 扫描
- 某仓库无权访问（私有）→ 跳过该仓库，记录到摘要
- Seeder MCP 不可用 → 保存检测结果到本地临时文件，下次重试
- state 文件损坏 → 重置为空，本轮全量扫描
