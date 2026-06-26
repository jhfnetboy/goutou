---
name: goutou-status
description: 狗头状态 — 一键查看协同中枢所有任务的全局进展：哪些仓库已响应、哪些在等待、哪些已完结。在任意仓库使用均可。触发词：/goutou-status、"看协同进展"、"协同状态"、"有哪些协同任务"。
---

# 狗头状态 / Goutou Status

快照式查看协同中枢的全局进展。不修改任何数据，只读。

## 激活时机

- 用户输入 `/goutou-status`
- 用户说"看一下协同进展"/"协同状态怎么样"/"有没有阻塞"

## 前置条件

- `seeder` MCP server 已配置（read 或 readwrite PAT 均可）

## 工作流

### Step 1：读配置，定位协同中枢

```bash
cat .goutou.json 2>/dev/null || echo "{}"
```

获取 `coordProjectId`。若无，调用 `list-projects` 搜索。

### Step 2：拉取所有协同任务

调用 `list-tasks`（projectId = coordProjectId，verbose = true）。

### Step 3：对每个任务，补全标签 + 评论状态

对非 terminal 任务，并行执行两个调用：
- `read-task`（projectId = coordProjectId，taskId = 任务 id）→ 获取 `labels[]` 和 `description`
- `list-task-comments`（projectId = coordProjectId，taskId = 任务 id）→ 获取评论列表

（注：`list-tasks` 返回精简行，不含 labels 或 description；两者均须通过 `read-task` 获取。）

**提取分配工兵列表（按优先级）：**
- P1（优先）：`task.labels` 里所有 name 以 `repo:` 开头的标签值（如 `repo:sdk`）
- P0（降级）：若 labels 为空，从 `task.description` 提取空格分隔的 `repo:<X>` token（格式如 `repo:contract repo:sdk repo:dvt`）

从评论的 `text` 字段识别已回复工兵：查找含 `[repo:<X>] 工兵回复` 的评论（`text` 为纯文本，heading 标记已剥离，格式正常保留）。

### Step 4：输出状态矩阵

```
🧠 协同中枢全局状态（<n> 个任务）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <任务标题>（<code>）— <状态名>
   分配：repo:contract  repo:sdk  repo:dvt
   ✅ 已回复：repo:contract（<时间>）
   ✅ 已回复：repo:sdk（<时间>）
   ⏳ 等待中：repo:dvt
   💬 <评论数> 条评论  │  🧠 军师汇总：<有/无>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ <已完结任务标题>（<code>）— 已完成

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

汇总：开放 <n1> 个（完全收敛 <n2>，等待中 <n3>）| 已完结 <n4> 个

提示：运行 /goutou-converge 可汇总并推进完全收敛的任务。
```

## 输出说明

- ✅ 已回复：该仓库工兵已发出评论
- ⏳ 等待中：该仓库尚未响应
- 🧠 军师汇总：已/无 — 收敛汇总评论是否存在
- 只读，任何情况下都不写入 Seeder
