---
name: goutou
description: 狗头工兵 — 多仓库协同响应者。轮询 Seeder 协同中枢，找到分配给本仓库的任务，结合本仓库代码上下文做分析并回复评论。配合 /loop 5m /goutou 实现定时轮询。每个子仓库安装一个。触发词：/goutou、"查协同任务"、"看看有没有我的任务"。
---

# 狗头工兵 / Goutou Soldier

在当前仓库作为协同工兵运行：检测本仓库身份 → 搜索分配给本仓库的协同任务 → 结合代码上下文分析 → 回复评论。

## 核心路由原则（先读，贯穿全流程）

**标签 = 强路由，@ = 弱信号。** 任务要不要落到某个仓库工兵的主队列，**只由 `repo:<ID>` 标签决定**——工兵 Step 2 用 `list-tasks(labelName="repo:<ID>")` 精确命中。评论文本里的 `@repo:<ID>` 只是给人看、走 Step 2b 子串搜索的弱补充，**会漏、会延迟，永远不能替代标签**。

> 反例（真实事故）：只 @ 不打标签的活，对方主扫描扫不到，全靠子串搜索碰运气 → 连漏好几轮。**派活必打标签**。

**一个狗头循环 = 三条泳道，全部显式汇报（Step 5），不许隐藏：**

| 泳道 | 触发 | 动作 | 汇报 |
|---|---|---|---|
| 🔍 **扫描** | 有 `repo:<REPO_ID>` 标签分给我的任务 | 结合代码上下文回复（Step 2–4c） | Step 5 「扫描」区 |
| 📨 **派活** | 我的分析需要别的仓库 `repo:X` 动手 | **给任务加 `repo:X` 标签** + @ 评论（Step 4d） | Step 5 「派活」区 |
| 📤 **交付/推送** | 我做完了下游依赖的东西 | 推送进度评论 + **给下游补 `repo:X` 标签**让它重扫 + 恢复 `/loop`（Step 6） | Step 5 「交付」区 |

每条泳道的每个动作（做了什么、路由给谁、加了什么标签）都必须出现在 Step 5。**静默动作 = bug。**

## 激活时机

- 用户输入 `/goutou`（单次手动触发）
- 配合 `/loop 5m /goutou` 每 5 分钟自动轮询
- 用户说"查一下协同任务"/"看看有没有我的任务"

## 前置条件

- `seeder` MCP server 已在本仓库配置（`.claude/settings.json` 或全局 `~/.claude.json`）
- PAT scope = `readwrite`（需要能发评论）
- 当前目录是 git 仓库

## 工作流

### Step 0：确定本仓库身份（REPO_ID）

按优先级顺序：

```bash
# 1. 读本地配置
cat .goutou.json 2>/dev/null || echo "{}"

# 2. 从 git remote 提取仓库名
git remote get-url origin 2>/dev/null | sed 's/.*[:/]//' | sed 's/\.git$//'

# 3. 兜底：用当前目录名
basename "$(pwd)"
```

- `.goutou.json` 有 `repoId` → 直接用
- 否则用 git remote 提取的仓库名（如 `sdk`、`contract`）
- 记录为 `REPO_ID`，**统一转为小写**（`list-tasks labelName` 做精确大小写匹配；`repo:SDK` 无法命中存储为 `repo:sdk` 的标签）

同时读取 `.goutou.json` 中的 `coordProjectId`（若有）。

### Step 1：定位协同中枢项目

若已有 `coordProjectId`（从配置读取），直接使用。

否则调用 `list-projects`，找名称含 `协同`/`coord`/`goutou`/`军师`/`hub` 的项目。

未找到 → 输出提示：「未找到协同中枢项目。请确认 Seeder 里已创建协同项目，或在 .goutou.json 里设置 coordProjectId。」停止。

### Step 2：拉取分配给本仓库的任务（含 @-mention 求助）

**首选（P1，Seeder ≥ 当前版本）**：调用 `list-tasks`（Seeder MCP）：
```
projectId = coordProjectId
labelName = "repo:<REPO_ID>"
isTerminal = false          ← 必须加，服务端过滤已完结任务，不读不浪费 token
```

**降级（P0，Seeder 较旧版本 / list-tasks 不支持 labelName 时）**：
调用 `search("repo:<REPO_ID>")` → 筛选 `type = "task"` 且 `projectId = coordProjectId` **且 `isTerminal = false`** 的结果。

> **精确匹配陷阱**：`search` 做子字符串匹配，`repo:app` 会误命中描述含 `repo:app2` 的任务。在 Step 3 的 `read-task` 后，额外检查 task description 中是否含精确 token `repo:<REPO_ID>`（以空格或行尾分隔，如 `repo:sdk ` 或行末 `repo:sdk`），不满足则跳过。

若无结果 → 进入 Step 2b（检查 @-mention 求助）。

### Step 2c：检查「我发起的任务」是否可以完结

> 此步与 Step 2 并行执行，不阻塞主流程。

调用 `list-tasks`：
```
projectId = coordProjectId
labelName = "from:<REPO_ID>"
isTerminal = false
```

对每个命中的任务，调用 `read-task` + `list-task-comments`，然后：

**① 前置门槛（机械检查，不满足直接跳过）**

1. 从 task 的 `labels[]` 中提取所有 `repo:X` 标签（即被分配的仓库列表）
2. 对每个 `repo:X`，检查评论列表中是否存在含 `[repo:X] 工兵回复` 且交付状态为 `✅` 的评论
   - `✅ 已实现` / `✅ implemented` / `✅ delivered` / `✅ done` / `✅ 无需操作` → 视为已交付
   - `⏳` / 无标记 → 视为未交付
3. 若有任何 `repo:X` 未 `✅` → **不做关闭判断**，记录「等待中：<repoId list>」到汇报，处理下一个任务

**② 发起仓库的验收判断（不是机械关闭，需要理解内容）**

前置门槛通过（所有工兵都 ✅）后，作为**需求发起方**，本仓库要结合自己的上下文做验收，而不是看到 ✅ 就闭眼关闭：

1. 读回本仓库当初发起该任务的诉求（task title + 首条军师评论的「需求背景/各仓库分工」）
2. 逐条读各 `repo:X` 工兵回复的**实际交付内容**（不只看 ✅ 标记，看它到底做了什么、交付了什么接口/版本/产物）
3. 结合本仓库代码上下文判断：
   - 各仓库交付是否**真正满足**当初的分工要求？（如需要新接口 → grep 确认本仓库能拿到；需要版本升级 → 确认版本号匹配）
   - 交付之间是否**自洽**？（如 contract 改了 selector，sdk 的 ABI 是否同步了对应 selector）
   - 是否留有**未闭合的依赖或后续动作**（工兵回复里写了 "待 X 确认" / "下一步需要…"）？
4. 结论分三种：
   - **可关闭**：交付满足验收，无遗留 → 走 ③ 关闭
   - **需追问**：交付有缺口/不自洽 → **不关闭**，用 `add-task-comment` 发一条 `[from:<REPO_ID>] 验收反馈`，指出具体缺口并 @ 对应 `repo:X`，把任务重新变成"等待中"，Step 4c 提示 /loop
   - **不确定**：涉及本仓库无法独立判断的跨仓库语义 → **不关闭**，发评论说明疑点，Step 5 汇报里标「待人工确认 <taskCode>」

**③ 关闭任务（仅当 ② 结论为「可关闭」）**

- 调用 `list-task-statuses`（projectId = coordProjectId）找 `isTerminal=true` 的 statusId
- 调用 `add-task-comment` 发一条 `[from:<REPO_ID>] 验收通过` 简评（1–2 句说明为什么判定满足，作为关闭依据留痕）
- 调用 `update-task`（taskId, projectId, statusId = terminal statusId，其余字段保持原值）
- 在 Step 5 汇报中注明：「已完结任务 <taskCode>：验收通过，已标记 Done」

> **为什么不机械关闭**：✅ 只代表工兵"自认为做完了"，但是否满足发起方的真实诉求、各仓库交付是否拼得起来，只有需求发起方结合自己的上下文才能判断。机械关闭会漏掉"各自都 ✅ 但接口对不上"这类问题。

> **标签约定**：任务创建时（通过 `/goutou-commander` 或 `goutou-watch`）需同时打 `from:<REPO_ID>` 标签，标识发起仓库。缺少此标签则跳过完结检查。

### Step 2b：检测 @-mention 求助

除了「分配给我」的任务，还需响应「其他仓库在评论中 @我」的求助。

调用 `search("@repo:<REPO_ID>")` 或 `list-tasks`（不带 labelName 过滤），对每个 open 任务：
- 调用 `list-task-comments`，在评论 `text` 中查找含 `@repo:<REPO_ID>` 的评论
- 若存在且我尚未发过 `[repo:<REPO_ID>] 协助回复` 评论 → 加入「求助响应列表」

> **求助响应格式**（在 Step 4c 中使用）：
> ```markdown
> [repo:<REPO_ID>] 协助回复
>
> ## 针对 @repo:<REPO_ID> 的求助
>
> <理解求助内容>
>
> ## 提供信息
>
> <具体回答：代码片段 / ABI / 接口定义 / 文件路径>
>
> ## 建议下一步
>
> <对方仓库可以怎么继续>
> ```

合并「分配任务」和「求助任务」为统一的待处理列表，进入 Step 3。

若两个列表均为空 → 输出：「本仓库（<REPO_ID>）暂无待处理的协同任务或求助。」结束。

### Step 3：逐个读取任务详情，判断是否需要响应

> **⚠️ 强制前置（零例外）**：对每个非完结任务，本轮都**必须**调用 `list-task-comments` 获取最新评论列表。「我刚发过回复」**永远不是**跳过 fetch 的理由——他仓回复可能在几秒内到达。禁止使用上轮记忆或假设替代本轮工具调用。没有查就不能断言「X 未回 / 无更新」。

对每个 hit，并行执行两个调用：
- `read-task`（projectId = coordProjectId，taskId = hit.id）→ 获取状态和描述
- `list-task-comments`（projectId = coordProjectId，taskId = hit.id）→ 获取**当轮最新**评论列表

> `read-task` 现在返回 `labels[]`（含 id/name/color），可作为第二路径确认 `repo:<REPO_ID>` 标签存在（P1 feature）。

**⚠️ 最优先分流（在所有跳过条件之前）**：若任务 `labels[]` 含 `pr-review` → **绕过下方全部普通跳过条件**（它没有军师分工评论，会被条件 3 误杀），仅在 `isTerminal=true` 时跳过；否则直接进 **Step 3-PR** 处理，不再走普通协同回复流。

**跳过条件**（仅对非 `pr-review` 任务；满足任一则跳过此任务，不发任何评论）：
1. `isTerminal = true`（任务已完结）
2. 评论列表中已存在包含 `[repo:<REPO_ID>] 工兵回复` 的评论，**且**该评论的交付状态为已完成：
   - 含 `✅ 已实现` / `✅ implemented` / `✅ delivered` / `✅ done` / `✅ completed` → **还需执行下方「新回复检测」再决定是否真正跳过**
   - 含 `⏳` / `方案已出，待实现` / `待开发` / `proposed` / `plan only` → **重新浮出**，当作未完成处理，继续进入 Step 4
   - 无明确状态标记 → **保守默认重新浮出**（宁可重复提醒，不漏掉未交付承诺）
3. 评论列表中**不存在**含 `各仓库分工` 文本的军师分工评论（军师分工尚未写入——task 仍在初始化中，此时响应会永久阻塞后续正确处理；下次轮询再检查）
   > 注意：Seeder 的 `list-task-comments` 返回 `text` 字段为纯文本，heading 标记（`##`/`###`）已被剥离——只用纯文字 `各仓库分工` 匹配，不要加 `## ` 前缀。
4. 军师分工评论的 `text` 中**不含** `repo:<REPO_ID>` 这一行（heading 标记已剥离，直接搜索 `repo:<REPO_ID>` 文字即可判断本仓库是否在分配列表中）

**机械检测「我最后发言之后的新回复」**（在跳过条件 2 判定为 `✅` 后执行）：

对评论列表按 `createdAt` 升序排列：
1. 找到本仓库（`text` 含 `[repo:<REPO_ID>]`）**最后一条**评论的 `createdAt`，记为 `myLastAt`
2. 检查是否存在任何评论满足：`createdAt > myLastAt` **且** `text` 不含 `[repo:<REPO_ID>]`
3. 若存在 → **强制重新浮出**，视为有新内容需响应，进入 Step 4（在回复中引用新评论内容）
4. 若不存在 → 才真正跳过

> 这是一个确定性检查，不依赖记忆。「我刚发」的任务如果他仓在 5 秒后回了，下轮必须接上。

**待响应任务**：所有未被跳过的任务及其评论列表，记录到待响应列表。
> 若因「方案已出未实现」或「他仓有新回复」重新浮出，在 Step 4c 回复时引用上次评论，说明当前实际进展或响应新内容。

**任务分流**：对每个待响应任务，先看标签——
- 含 `pr-review` 标签 → 走 **Step 3-PR（PR-review 修复分支）**，**不走** Step 4 普通协同回复
- 其余 → 走 Step 4

### Step 3-PR：PR-review 修复分支（本仓库的 PR 被 pr-daemon 打回）

> 完整规范：`~/Dev/jhfnetboy/goutou/docs/goutou/PR-REVIEW.md`。触发：任务含 `pr-review` + `repo:<MY_REPO_ID>` 标签，description 含 `pr:OWNER/REPO#N`。含义：pr-daemon 审了本仓库一个 PR，结论 REQUEST_CHANGES，路由回我来修。

**PR-1 解析**：从 description 提取 `OWNER/REPO`、`#N`、当前 Head SHA；从评论里最新一条 `[pr-daemon] REVIEW REQUEST_CHANGES` 提取 blocking findings 列表。

**PR-2 前置校验**：
```bash
gh pr view N --repo OWNER/REPO --json state,headRefName,headRefOid,author
```
- `state` != OPEN（已 merged/closed）→ 不修，评论说明并请 Step 2c 关任务，跳过
- 我已修过且 head SHA 未变（评论里我上条 `🔧 已修复 @<sha>` 的 sha == 当前 headRefOid）→ 说明 pr-daemon 还没重审，跳过等待

**PR-3 分级（复用 `$pr-fix` 的 Tier A/B/C 判据，严格套用 §7 安全约束）**：
- **Tier A 自动修**：docs/typo/style/单函数 1:1 映射的 code fix，改动逻辑行 ≤30，不改公共 API/流程 → 直接修
- **Tier B 计划先行**：跨模块(>2 文件不同目录)/改公共签名·auth·schema/意见含"refactor·redesign·move"/安全敏感且逻辑行>30 → **不自动改**，评论出 fix 计划请示用户，保留标签，Step 5 标「待批」
- **Tier C 只建议**：逻辑行>150/核心合约非平凡改动/跨≥2 仓库/token经济·代理升级·权限·费用数学/需跑本地跑不了的测试 → **不改**，评论列建议方案，Step 5 标「待人工」

**PR-4 修复（仅 Tier A，或 Tier B 获批后）**：
1. `git fetch && git checkout <headRefName>`（在本仓库目录，全上下文）
2. 逐条 findings 修——**只修被指出的问题，不顺手重构/改名/扩大范围**
3. 自审：对**修复 diff**跑 mini-review（docs/style 2 轮；code/安全 4 轮），**不过就迭代，绝不 push**
4. **加新 commit**（绝不 force push、绝不 `--amend` 已推送 commit）→ `git push`
5. `gh pr edit N --repo OWNER/REPO --add-reviewer clestons`（触发 pr-daemon 重审；即使不加，增量发现也会因 head 变化重审）

**PR-5 回写 Seeder**：
- `add-task-comment`：`[repo:<MY_REPO_ID>] 🔧 已修复并重新请求 review @<newsha8>` + 逐条说明改了什么（Tier A）；或计划/建议（Tier B/C）
- Tier A 修完 → `remove-task-label` 摘掉 `repo:<MY_REPO_ID>`（暂离我的队列，等 pr-daemon 重审）；Tier B/C → **保留**标签（仍需我/用户跟进）
- 后续 pr-daemon 重审：APPROVE → 它把任务移 Done；再 RC → 它重新挂 `repo:<MY_REPO_ID>`，下轮我再接上，循环直到 approve

> **安全约束（PR-REVIEW.md §7，必守）**：不 force push；自审必过才 push；不改别人业务逻辑；模糊/架构意见不猜（→Tier B/C 请示）；安全敏感 PR（recovery/owner-change/payment/permission/.sol/签名）强制 4 轮自审 + 倾向 Tier B。

### Step 4：分析并回复

对每个待响应任务：

**Step 4a：理解分工**

在 Step 3 已获取的评论列表中，找到含 `各仓库分工` 的军师分工评论。

> Seeder `list-task-comments` 返回的 `text` 字段是纯文本（heading `##`/`###` 已剥离）。将文本按行分割，找到内容为 `repo:<REPO_ID>` 的行，提取该行到下一个 `repo:` 行之间的文本作为分工说明。例如，原 markdown 的 `### repo:sdk` 在 text 中变为 `repo:sdk`。

**Step 4b：结合本仓库代码上下文分析**

根据分工说明，在本仓库代码中查找相关文件/模块/接口：
- 若需实现新接口 → 找相关代码位置，给出具体文件路径和方案
- 若需读取上游输出 → 确认依赖接口定义，提出问题（若上游未回复）
- 若有阻塞 → 明确说明阻塞原因和等待内容

**Step 4c：发布回复**

- 若是「分配任务」→ 发工兵回复（格式如下）
- 若是「@-mention 求助」→ 发协助回复（格式见 Step 2b）

> **跨仓 ask 后续挂钩**：若回复中包含「等待 @repo:X 提供...」类的阻塞声明，在发完评论后立即提示用户（或自动触发）：「有 <n> 个任务等待他仓回复，建议运行 `/loop 5m /goutou` 自动接收。」不要依赖用户主动来戳——定时轮询是接收跨仓回复的唯一可靠机制。

调用 `add-task-comment`（projectId = coordProjectId，taskId = 当前任务 id），内容格式：

```markdown
[repo:<REPO_ID>] 工兵回复

## 分析结果

<对分工要求的理解 + 本仓库当前状态>

## 技术方案

<具体实现思路，含关键文件路径（file:line 格式）>

## 对外输出

<本仓库将提供的接口/类型定义/ABI，供下游仓库参考>
（若无对外输出则省略此节）

## 工期估算

<乐观/悲观估算>

## 阻塞 / 依赖

<等待上游 repo:xxx 提供：具体内容>
（若无阻塞则写「无阻塞，可独立启动」）

## 交付状态

⏳ 方案已出，待实现
```

> **必填**：每条工兵回复必须以 `## 交付状态` 一行结尾，用于 Step 3 跳过条件判断：
> - `⏳ 方案已出，待实现` — 初次分析，方案未落地
> - `⏳ 待开发 / 待审计 / 待部署` — 进行中具体阶段
> - `✅ 已实现` — 代码已合并/完成，可跳过
> - `✅ 已实现（PR: <url>）` — 带 PR 链接证明
> - `✅ 无需操作（<原因>）` — 本仓库不受影响
> 
> **重新浮出时**：在 Step 3 发现旧评论含 `⏳` 时，发新评论而非替换旧评论，引用上次评论并说明当前进展。

### Step 4d：派活——把跨仓依赖升级为标签路由（强制，泳道 📨）

只要本轮回复的 `## 阻塞 / 依赖` 一节非空（出现「等待 repo:X 提供…」/「依赖 repo:X 的…」这类跨仓依赖），**不能只在文字里 @ 就完事**——必须把活真正路由给对方：

1. `list-task-labels`（projectId = coordProjectId）→ 找 `repo:X` 标签 id；缺则 `create-task-label` 新建（颜色按 goutou-commander Step 4 的组织配色规则，须精确匹配 Seeder 24 色 palette）
2. **`add-task-label`（projectId, taskIds=[当前任务], labelIds=[repo:X 的 id]）**——这一步是关键：让 repo:X 的工兵在它自己的 Step 2 主扫描 `list-tasks(labelName="repo:X")` 里**精确命中**这条任务，进它的主队列
3. 回复评论里同时保留 `@repo:X`（给人看 + Step 2b 弱补充），并在 `## 阻塞 / 依赖` 写清「需要 repo:X 提供的具体内容」
4. 记录到 Step 5「📨 派活」区：路由给了谁、加了什么标签、要对方提供什么

> **为什么必须加标签**：`@repo:X` 只走对方 Step 2b 子串搜索，会漏会延迟（漏活根因）。加了 `repo:X` 标签后对方 Step 2 主扫描直接命中——这是唯一可靠的跨仓派活方式。@ 是弱信号，标签才是入队凭证。

> **幂等**：若任务已有 `repo:X` 标签（之前已派过），跳过 add，但仍在 Step 5 标注「已在等待 repo:X」。不要重复建标签。

> **派完活务必挂 `/loop`**：派出去的活靠对方工兵轮询接收；本仓库也要 `/loop 5m /goutou` 才能在对方回复后几分钟内自动接上。见 Step 5 结尾提示。

### Step 5：汇报本轮执行结果

一个狗头循环做的**所有**事都要列出来，不许隐藏。按三条泳道汇报：

```
🐾 工兵巡逻完毕（repo:<REPO_ID>）

🔍 扫描（分配给我的任务）：<n> 个
└─ 已响应：<m> 个（列出标题）
└─ 新回复触发重新浮出：<r> 个（他仓在我上次发言后有新评论）
└─ 跳过（已回复且无新评论）：<k> 个
└─ 跳过（已完结）：<j> 个
└─ 跳过（初始化中）：<i> 个（下次轮询再试）
└─ 跳过（未分配给我）：<h> 个
└─ 跳过（任务不可读）：<g> 个

📨 派活（我路由给别的仓库的活）：<p> 个
└─ <taskCode>：+repo:X 标签 + @repo:X，需对方提供 <具体内容>
（本轮无派活则写「本轮无派活」）

📤 交付/推送（我做完、推给下游的）：<q> 个
└─ <taskCode>：交付 <内容>，已给下游 repo:Y 补标签让它重扫
（本轮无交付则写「本轮无交付」）

✅ 完结（我作为发起方验收关闭的，来自 Step 2c）：<c> 个
└─ <taskCode>：验收通过，已标记 Done
（本轮无完结则写「本轮无完结」）

📮 @-mention 求助（弱信号补扫，Step 2b）：<n2> 个
└─ 已协助回复：<m2> 个（列出来自哪个仓库的求助）
└─ 已处理（跳过）：<k2> 个
```

> **显式原则**：派活（📨）、交付（📤）、完结（✅）三条泳道即使本轮为 0 也要**明确写出「本轮无 X」**，不能省略整行——用户要一眼看清这个循环到底做了哪几类事，而不是只看到「扫描」以为工兵只会扫描。

> **⚠️ 若有等待他仓回复的任务（阻塞 / ⏳ 状态）**：
> 强烈建议运行 `/loop 5m /goutou` 自动轮询——手动巡逻依赖注意力会漏掉他仓回复。
> 定时轮询让他仓回复 5 分钟内自动被接上。

```
下次运行：/loop 5m /goutou（推荐，自动接收他仓回复）  或  /goutou（单次手动）
```

### Step 6：完成后交付/推送 + 恢复（泳道 📤）

本轮有实质性工作完成（发了回复、有新 commit/PR、交付了下游依赖的东西）时，把「自己上下文里的更新」显式推给相关仓库，而不是做完就沉默：

**① 推送进度评论**——在对应 Seeder 任务追加：
```markdown
[repo:<REPO_ID>] 进度更新

完成度：<X>%
最新进展：<1-2 句 / 交付了什么接口/版本/产物>
预计完成：<时间估算>
```

**② 若我这次交付**解除了某个下游仓库 `repo:Y` 的阻塞（它在等我这份产物）——**给任务补 `repo:Y` 标签**让它重扫（同 Step 4d 的 add-task-label 流程），并在评论 @repo:Y 说明「你等的 <产物> 已就绪，可以继续」。**只 @ 不打标签会漏**，同样的强路由原则。

**③ 恢复轮询**——凡本轮有任何「派活」或「等下游回复」的动作，结尾提示（或自动挂）`/loop 5m /goutou`：派出去的活和推给下游的更新，都要靠持续轮询在几分钟内接回它们的回复。

- 若无任何进展/交付需推送 → 跳过此步，但在 Step 5「📤 交付」区明确写「本轮无交付」。

## 与 /loop 配合使用

**强烈推荐**：只要有任何任务处于「等待他仓回复」状态，就应启动持续轮询：

```
/loop 5m /goutou
```

工兵每 5 分钟自动检查一次，有新评论时立即触发「机械检测新回复」逻辑并响应，无变化时静默跳过（只输出一行摘要）。

> **为什么不用手动？** 手动巡逻依赖你记得去戳，而他仓可能在任何时刻回复。`/loop` 把「接收跨仓回复」变成确定性的 5 分钟 SLA，而不是「不知道什么时候」。

单次 `/goutou` 仅适合「我就想查一次」的场景；等待上游结果时请挂 `/loop`。

## 错误处理

- Seeder MCP 未配置 → 告知用户配置 MCP（见 docs/goutou/README.md）
- REPO_ID 无法确定 → 提示用户在 `.goutou.json` 里设置 `repoId`
- `read-task` 返回 null → 跳过该任务（可能已被删除或无权访问）
- 评论发布失败 → 告知用户，不重试
- **禁止的行为**：不得在没有本轮 `list-task-comments` 调用结果的情况下，断言某任务「无新回复」「对方尚未回复」「我刚发过所以跳过」。所有关于评论状态的陈述必须来自当轮工具返回值。
