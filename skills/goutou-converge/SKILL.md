---
name: goutou-converge
description: 狗头军师收敛 — 扫描协同中枢，检测哪些任务的所有工兵都已回复，自动生成汇总评论，并将任务推进到下一状态（doing/done）。在 goutou 主控仓库使用。触发词：/goutou-converge、"看看有没有收敛"、"汇总进展"、"推进任务状态"。
---

# 狗头收敛 / Goutou Converge

军师的收敛阶段：扫描协同中枢的开放任务 → 检测哪些任务所有工兵都已响应 → 自动生成汇总评论 → 推进任务状态。

## 激活时机

- 用户输入 `/goutou-converge`（手动触发一次）
- 配合 `/loop 30m /goutou-converge` 定期检查收敛
- 用户说"看看有没有收敛"/"汇总一下进展"/"推进任务状态"

## 前置条件

- `seeder` MCP server 已配置（readwrite PAT）
- 当前工作目录是 goutou 仓库

## 工作流

### Step 0：读配置，定位协同中枢

```bash
cat .goutou.json 2>/dev/null || echo "{}"
```

获取 `coordProjectId`（必须）。若无，同 goutou-commander 的 Step 1 搜索。

### Step 1：获取所有开放的协同任务

调用 `list-tasks`（projectId = coordProjectId，verbose = true）。

筛选 `isTerminal = false` 的任务（开放任务）。

若无开放任务 → 输出：「协同中枢暂无开放任务。」结束。

### Step 2：逐个检查收敛状态

对每个开放任务，调用 `read-task` 获取：
- `labels`：已分配的仓库列表（所有 `repo:*` 标签）
- 评论列表（`list-task-comments`）

**收敛判断逻辑：**

```
分配的工兵仓库（按优先级）：
  P1（优先）: task.labels 里所有 name 以 "repo:" 开头的标签值
  P0（降级）: 若 labels 为空，从 task.description 提取 "repo:<X>" 空格分隔 token

已回复仓库    = 评论列表里含 "[repo:<X>] 工兵回复" 的去重集合
待响应仓库    = 分配的工兵仓库 - 已回复仓库
```

> 提取已回复仓库时：评论 `text` 字段是纯文本（heading 标记已剥离），直接查找 `[repo:<X>] 工兵回复` 文字。
> 从评论 marker `[repo:sdk]` 得 repoId = `sdk`（去掉 `[repo:` 前缀和 `]` 后缀）。

- `分配的工兵仓库 == 空`（无标签也无 description token）：跳过此任务（纯军师任务或无路由信息）
- `待响应仓库 == 空`：**完全收敛** → 需要汇总 + 推进状态
- `待响应仓库 != 空`：**部分收敛** → 仅记录，不处理

### Step 3：对「完全收敛」任务生成汇总

对每个完全收敛且**尚未有汇总评论**（检查评论是否含 `🧠 军师汇总`）的任务：

**Step 3a：分析所有工兵回复**

读取所有 `[repo:*] 工兵回复` 评论，提取：
- 各仓库的技术方案要点
- 各仓库的对外输出/接口定义
- 阻塞和依赖关系

**Step 3b：生成汇总评论**

调用 `add-task-comment`，内容格式：

```markdown
🧠 军师汇总

## 收敛状态

所有工兵已响应（<仓库列表>）。

## 各仓库方案摘要

### repo:contract
<要点 1–3 条>

### repo:sdk
<要点 1–3 条>

（其他已响应仓库）

## 关键接口定义

<从工兵回复中提取的最重要接口/数据结构定义>

## 执行路径

<基于依赖关系建议的实施顺序，如: contract → sdk → app>

## 风险 / 待确认

<工兵回复中提到的阻塞或不确定点>

---
*🧠 军师收敛汇总 · 任务进入执行阶段*
```

**Step 3c：推进任务状态**

调用 `list-task-statuses`（projectId = coordProjectId）找到"进行中"类状态（name 含 `doing`/`进行`/`in progress`/`进中`，或 `isInitial=false` 且 `isTerminal=false` 的第一个）。

若找到合适状态 → 调用 `update-task-status`（projectId = coordProjectId，taskId，statusId）。

若项目只有 initial/terminal 两种状态 → 不改状态，在汇总评论末尾注明「请手动将任务移至"进行中"。」

### Step 4：输出收敛报告

```
🧠 军师收敛报告

已扫描协同任务：<n> 个

完全收敛（已汇总）：<m> 个
  ✅ <任务标题>（<code>）→ 状态：<update-task-status 实际结果，成功则写新状态名，失败则写"状态推进失败，请手动操作">

部分收敛（等待中）：<k> 个
  ⏳ <任务标题>（<code>）— 等待：repo:contract, repo:dvt

无需处理（已完结/无工兵）：<j> 个
```

## 与 /loop 配合

```
/loop 30m /goutou-converge
```

每 30 分钟检查一次收敛状态，有新的完全收敛任务时自动汇总。

## 错误处理

- `list-task-statuses` 无结果 → 跳过状态推进，仅发汇总评论
- `update-task-status` 失败（无权限）→ 告知用户手动推进
- 汇总评论发布失败 → 告知用户，不重试
