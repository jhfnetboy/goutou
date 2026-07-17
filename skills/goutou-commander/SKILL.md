---
name: goutou-commander
description: 狗头军师 — 多仓库协同指挥官。输入一句话业务诉求，自动在 Seeder 协同中枢创建任务、打 repo:* 路由标签、写首条分工评论，输出任务链接。任意仓库均可发起，需在仓库根目录有 .goutou.json 或 Seeder 里存在协同项目。触发词：/goutou-commander、"军师帮我协调"、"分发任务"、"多仓库联动"。
---

# 狗头军师 / Goutou Commander

多仓库协同指挥中枢。解析业务诉求 → 拆解仓库分工 → 在 Seeder 创建协同任务 → 打路由标签 → 写首条分工评论。

## 激活时机

- 用户输入 `/goutou-commander <需求描述>`
- 用户说"军师帮我协调…" / "需要多仓库联动…" / "分发任务给…"
- 在 goutou 仓库目录下工作时，有跨仓库协作需求

## 前置条件

- Seeder MCP server 已配置（`~/.claude.json` 中 `mcpServers.seeder`，PAT scope = `readwrite`）
- Seeder 里存在「协同中枢」项目（或当前仓库根目录有 `.goutou.json` 含 `coordProjectId`）
- **任意仓库均可发起**，不限于 goutou 主控仓库

## 工作流

### Step 0：读本地配置

```bash
cat .goutou.json 2>/dev/null || echo "{}"
```

解析结果：
- `coordProjectId`：协同中枢项目 ID（若有则直接用，跳过 Step 1 的搜索）
- `seederUrl`：Seeder 实例地址（仅供展示用）

### Step 1：定位协同中枢项目

调用 `list-projects`（Seeder MCP）。

在返回的项目列表中查找名称含以下关键词的项目（不区分大小写）：
`协同`、`coord`、`goutou`、`军师`、`hub`

- **找到 1 个** → 记录 `coordProjectId`；若 `.goutou.json` 无此字段，立即写入（Read→合并→Write），避免后续失败重复搜索
- **找到多个** → 列出所有匹配项目，请用户确认用哪个，或在 `.goutou.json` 中设置 `coordProjectId` 精确锁定，停止执行
- **未找到** → 告知用户：「请先在 Seeder 里创建一个协同中枢项目，然后在 .goutou.json 里设置 coordProjectId，或将项目命名为包含"协同/coord/goutou"。」停止执行

### Step 2：分析诉求，拆解仓库分工

从用户输入提取：

**需求摘要**（≤ 50 字，作为 Task 标题）

**涉及仓库列表**（推断或从用户说明读取）。完整 REPO_ID 见 `docs/goutou/REPO-IDS.md`，常用速查：

AAstar: `airaccount` · `air-contract` · `paymaster` · `relay` · `ultrarelay` · `aastar-sdk` · `yaaa`
AuraAI: `agent24` · `idoris` · `idoris-sdk` · `aura-pkg` · `speaker` · `social`
Mycelium: `cos72` · `sin90` · `cityos` · `comet` · `pnts` · `park` · `spores` · `launch` · `mytask` · `listener`

依赖方向（上游 → 下游）：`air-contract → airaccount → relay → paymaster → aastar-sdk → cos72/sin90/launch`

**各仓库分工**（每个仓库 2–3 句：做什么、输出什么、依赖什么）

**执行顺序建议**（若有上下游依赖关系）

若无法推断涉及哪些仓库，先问用户确认，再继续。

### Step 3：创建协同任务

**确认发起仓库 REPO_ID**：
- 读 `.goutou.json` 中的 `repoId` 字段
- 若无，运行 `git remote get-url origin | sed 's/.*\///' | sed 's/\.git//'` 自动推断
- 记为 `<MY_REPO_ID>`（如 `goutou`、`sdk`、`cos72`）

调用 `create-task`（Seeder MCP）：
```
projectId   = coordProjectId
title       = <需求摘要>
description = "repo:<仓库1> repo:<仓库2> repo:<仓库3> from:<MY_REPO_ID>"
```

**description 格式严格**：
- 每个涉及仓库用 `repo:` 前缀、空格分隔（如 `repo:contract repo:sdk repo:dvt`）。这是工兵 P0 阶段 `search("repo:<ID>")` 能找到此任务的唯一依据——Seeder 只索引任务标题和描述，不索引评论。
- `from:<MY_REPO_ID>` 标记发起仓库，供工兵 Step 2c 的完结检查识别（当所有 `repo:X` 均 ✅ 时，`from:` 仓库可自动关闭任务）。

记录返回的 `taskId`。然后调用 `read-task`（projectId = coordProjectId，taskId = 新 taskId）获取任务 `code`（任务编号，如 `COORD-42`）和 `title`，供 Step 8 展示。

### Step 4：确保 repo:* 和 from:* 标签存在

对每个涉及仓库**以及发起仓库**，执行（可并行）：

1. 调用 `list-task-labels`（projectId = coordProjectId）
2. 检查是否已有名为 `repo:<仓库ID>` 的标签（精确匹配）；同样检查 `from:<MY_REPO_ID>`
3. 若无 → 调用 `create-task-label`：
   - `projectId` = `coordProjectId`
   - `name` = `repo:<仓库ID>`
   - `color` = 按组织分配（必须精确匹配 Seeder 24 色 palette，否则 Zod 校验失败）：
     - AAstar 仓库（airaccount/air-contract/paymaster/relay/ultrarelay/aastar-sdk/yaaa/aastar-docs/abi-docs/registry）→ `#5e6ad2`（Aether）
     - AuraAI 仓库（agent24/idoris/idoris-sdk/aura-pkg/speaker/social）→ `#8b5cf6`（Amethyst）
     - Mycelium 仓库（cos72/sin90/cityos/comet/pnts/park/spores/launch/mytask/listener/expresser/myvote/mynft）→ `#27a644`（Emerald）
     - 其他 / 跨组织 → `#ef8b3a`（Orange）
     
     完整 REPO_ID 列表见 `docs/goutou/REPO-IDS.md`

可并行处理多个仓库的标签检查+创建。

### Step 5：给任务打路由标签（含发起仓库标签）

调用 `add-task-label`：
```
projectId = coordProjectId
taskIds   = [taskId]
labelIds  = [所有涉及仓库对应的 labelId] + [from:<MY_REPO_ID> 对应的 labelId]
```

> `from:<MY_REPO_ID>` 标签使发起仓库的工兵在 Step 2c 中能用 `list-tasks(labelName="from:<MY_REPO_ID>")` 找到该任务，检测何时可自动完结。

### Step 6：写首条分工评论

调用 `add-task-comment`（projectId = coordProjectId，taskId = Step 3 的 taskId），内容如下：

```markdown
## 需求背景

<1–2 句背景说明>

## 各仓库分工

### repo:contract
<合约需要做的事，输出什么>

### repo:sdk
<SDK 需要封装什么，依赖 contract 的哪些输出>

### repo:dvt
<后端需要提供什么接口>

（其他涉及仓库同上格式）

## 执行顺序建议

<有依赖关系时说明推荐顺序，如：contract → sdk → app>

---
*🧠 军师创建 · 等待各仓库工兵响应*
```

> **注意**：搜索路由标记已写入 Step 3 的 task description（`repo:xxx` 格式），评论无需重复写。

### Step 8：输出结果

向用户展示：

```
✅ 协同任务已创建

任务：<title>（<code>）
项目：<协同中枢项目名>
已分配仓库：repo:contract、repo:sdk、repo:dvt

各仓库工兵启动命令：
  cd /path/to/sdk && /goutou        # 单次响应
  cd /path/to/sdk && /loop 5m /goutou   # 定时轮询

在 Seeder 查看完整进展：<seederUrl>/projects/<coordProjectId>（若 .goutou.json 未配置 seederUrl 则省略此行）
```

## 错误处理

- Seeder MCP 未配置 → 告知用户按 docs/goutou/README.md 配置 MCP
- PAT 为 read 只读 → 告知需要 readwrite scope 的 PAT
- 协同项目未找到 → 见 Step 1 的处理
- 标签创建失败（权限不足）→ 告知用户：标签管理需要协同项目的 `taxonomy.manage` 能力，默认 owner/leader 有此权限，但也可能被项目管理员单独授权给 member；请检查 Seeder 项目成员权限设置
