# 狗头 × pr-daemon：PR Review 协同流程

> 把 pr-daemon 的自动 PR review 引擎接入 goutou 协同总线。
> pr-daemon **当引擎**（发现 + 三轮 PK review），goutou **当协同/路由层**（可见性 + 把 REQUEST_CHANGES 路由回原仓库工兵去修）。

---

## 1. 为什么这样分工

pr-daemon 自身已经具备完整能力，**不要重复造轮子**：

- `pr-daemon-loop`：自动发现三组织（AAStarCommunity / AuraAIHQ / MushroomDAO）全部 open PR，按 head SHA 增量，三/四轮 PK（DeepSeek → Sonnet → Opus → Codex）出 `APPROVE` / `REQUEST_CHANGES`。**只 review，从不 merge。**
- `$pr-fix`：能自动修 **jhfnetboy 自己的 PR** + **bot PR（dependabot/renovate）**，修→自审→push→重新请 review→循环直到 approve。**明确拒绝修其他作者的 PR。**

所以「检测新 PR 并触发 review」pr-daemon 早已自动完成，**无需 goutou 触发**。goutou 只补两件 pr-daemon 做不到的事：

1. **RC 路由到原仓库自己的 `/goutou` 工兵去修** —— 原仓库工兵在自己目录、有自己的 CLAUDE.md / 测试 / 上下文，比 pr-daemon 在克隆目录盲修强；且覆盖**任意作者**的 PR，不限 jhfnetboy。
2. **PR review 状态进入 goutou 协同矩阵**，和其他跨仓库任务一起在 `/goutou-status` 可见。

---

## 2. 任务创建时机（收敛，低噪音）

**只在以下条件同时满足时**，pr-daemon 在 Seeder 建/更新一条 PR-review 任务：

- 本轮 verdict == `REQUEST_CHANGES`，**且**
- 该 PR 的仓库是 goutou 已注册仓库（`docs/goutou/REPO-IDS.md` / `.goutou-deps.json` 里有对应 `repoId`）

理由：首轮就 `APPROVE` 的 PR 没有要协同的事，不建任务省噪音；真正要人动手的是被打回的那批。若一个 PR 先 RC（建了任务）后来 approve，则**关闭**那条任务（见 §5）。

> bot PR（dependabot/renovate）继续走 pr-daemon 自己的 `$pr-fix` 内部闭环，**不进** goutou 总线（bot 无法响应 `/goutou`）。

---

## 3. 任务数据模型（约定即契约）

一个 PR 对应一条任务，幂等 upsert，靠 description 里的 `pr:<OWNER/REPO>#<N>` token 唯一定位。

| 字段 | 值 |
|---|---|
| **title** | `[PR] <OWNER/REPO>#<N>: <PR 标题截断>` |
| **description** | 必含三个 token（空格分隔，供 `search` 命中）：`pr:<OWNER/REPO>#<N>`、`repo:<originRepoId>`、`from:pr-daemon`；另附 PR URL、当前 head SHA、最新 verdict、轮次 |
| **labels** | `pr-review`（分类标记，Orange `#ef8b3a`）+ `repo:pr-daemon`（reviewer）+ `repo:<originRepoId>`（**仅 RC 时挂**，路由给原仓库工兵；approve 时该任务直接进 Done） |
| **status** | RC 期间 open（`📢 变更通知` 或 `Todo`）；APPROVE 时移到 terminal（`Done`） |

**评论时间线**（工兵靠评论读 findings，不需要读 GitHub PR）：

- pr-daemon 每次出结论：`[pr-daemon] REVIEW <verdict> @<sha8>` + 若 RC 则附 blocking findings（`[Sev] file:line — 问题 | 建议`，top ~5）。
- 原仓库工兵修完：`[repo:<id>] 🔧 已修复并重新请求 review @<newsha8>`。

### description 模板

```
pr:AAStarCommunity/aastar-sdk#42 repo:sdk from:pr-daemon

PR: https://github.com/AAStarCommunity/aastar-sdk/pull/42
Head: 9f3a1c2
Verdict: REQUEST_CHANGES (4-round)
Author: <login>
Updated: 2026-07-14T12:00:00+08:00
```

---

## 4. github → repoId 映射

单一权威源：`~/Dev/jhfnetboy/goutou/.goutou-deps.json`（`repos.<id>.github` 字段）与 `docs/goutou/REPO-IDS.md`。
pr-daemon 侧同步步骤读该文件把 `OWNER/REPO` 反查成 `repoId`；查不到 → 该 PR 不进 goutou 总线（非生态仓库）。

---

## 5. 完整流程

```
pr-daemon-loop（自己的引擎，不改动发现+PK）
  └─ Step 6 post_pr_review.sh 发 verdict + Step 7 记 SQLite
       └─ Step 6.5【新增】同步到 goutou 总线：
            ├─ APPROVE：若存在该 PR 的任务 → 移到 Done + 评论「✅ APPROVED」；无则跳过
            └─ REQUEST_CHANGES 且原仓库已注册：
                 upsert 任务 → 挂 pr-review + repo:pr-daemon + repo:<originRepoId>
                 评论 findings，状态保持 open
                                   │
                                   ▼
原仓库 /loop 5m /goutou 工兵（在自己仓库目录，全上下文）
  └─ 发现 pr-review + repo:<MY_REPO_ID> 的任务（= 我的 PR 被打回）
       ├─ 读 findings → 按 Tier 分级（复用 $pr-fix 的 A/B/C 判据）
       │    Tier A 自动修 · Tier B 出计划待批 · Tier C 只建议不改
       ├─ Tier A：checkout PR 分支 → 修 → 自审 → 新 commit（不 force push）→ push
       │           → gh pr edit --add-reviewer clestons（触发 pr-daemon 重审）
       │           → 评论「🔧 已修复 @<newsha>」+ 摘掉 repo:<MY_REPO_ID> 标签（暂离我的队列）
       └─ Tier B/C：不自动改，评论说明 + 保留标签，Step 5 汇报里标「待人工」
                                   │
                                   ▼
pr-daemon 下轮按 head SHA 变化重审 → APPROVE 关任务 / 再 RC 重新挂 repo:<id> → 循环
```

**重审触发**：原仓库工兵 push 后 `gh pr edit --add-reviewer clestons` 显式请重审；即使不加，pr-daemon 增量发现也会因 head SHA 变化重审。

---

## 6. 与 `$pr-fix` 的去冲突（重要）

pr-fix 和 goutou 都可能想修 **jhfnetboy 在 goutou 仓库里的 PR**，会撞车。规则：

> **goutou 已注册仓库的 human PR → 由原仓库 `/goutou` 工兵负责修，`$pr-fix` 跳过。**
> `$pr-fix` 继续负责：① 非 goutou 仓库里 jhfnetboy 的 PR；② 全部 bot PR。

判据（pr-fix Step 1 队列过滤时）：若该 PR 在 goutou `.goutou-deps.json` 有对应 `repoId`，且 Seeder 里存在其 `pr:<OWNER/REPO>#<N>` 任务 → 标记 `SKIP（goutou-routed）`，不处理。

---

## 7. 安全约束（原仓库工兵修复时必须遵守，继承自 $pr-fix）

- **绝不 force push、绝不 `--amend` 已推送的 commit** —— 只在分支上加新 commit。
- **自审必须通过才 push** —— 对「修复 diff」跑 mini-review（2/4 轮按风险），不过就迭代不推。
- **不改别人的业务逻辑** —— 只修被 review 指出的具体问题，不顺手重构/改名/扩大范围。
- **模糊/架构性意见 → 不猜** —— 标 Tier B/C，评论请示用户，绝不擅自改。
- **安全敏感 PR**（recovery / owner-change / payment / permission / .sol / 签名）→ 强制 4 轮自审，倾向 Tier B 出计划。

---

## 8. 接线清单

**pr-daemon 仓库**（`~/Dev/tools/pr-daemon`）：
- `.goutou.json`：`{ repoId: "pr-daemon", coordProjectId, seederUrl }`
- `skills/pr-daemon-loop/SKILL.md`：新增 **Step 6.5 — Sync verdict to goutou bus**
- `skills/pr-fix/SKILL.md`：Step 1 加去冲突过滤（§6）
- 装载：`./install-skills.sh` 或 `cp` 到 `~/.claude/skills/`

**goutou 仓库**（本仓库）：
- `skills/goutou/SKILL.md`：新增 **PR-review 修复分支**（识别 `pr-review` + `repo:<MY_REPO_ID>` 任务 → 走 §5/§7 修复流）
- `docs/goutou/REPO-IDS.md`：注册 `pr-daemon` 仓库
- 同步 `~/.claude/skills/goutou/SKILL.md`

**前置**：Seeder MCP 在 pr-daemon 会话可用（`~/.claude.json` 全局 `mcpServers.seeder`，即使 pr-daemon 跑在 DeepSeek endpoint 上，MCP 与模型 endpoint 无关，照常可用）。

---

*🐾 goutou × pr-daemon PR-review 集成规范 · 维护者 jason*
