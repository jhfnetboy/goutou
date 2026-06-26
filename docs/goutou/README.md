# 狗头军师协同系统

多仓库 Claude Code 协同方案，以 Seeder 为中央看板+MCP 总线，替代在多个 terminal 窗口间手工复制粘贴的低效模式。

## 架构概览

```
用户（在 goutou 仓库）
  │
  ▼  /goutou-commander "积分系统：合约出接口，SDK 封装，App 调用"
  │
  ▼  Seeder 协同中枢（中央 MCP 总线）
  │    └─ Task: "积分系统"
  │         ├─ Label: repo:contract
  │         ├─ Label: repo:sdk
  │         ├─ Label: repo:app
  │         └─ Comment: 军师分工说明
  │
  ├─ contract 仓库 Claude → /goutou → 读任务 → 回复接口方案
  ├─ sdk 仓库 Claude      → /goutou → 读任务 → 回复封装方案
  └─ app 仓库 Claude      → /goutou → 读任务 → 回复调用方案
```

**军师（/goutou-commander）**：在 goutou 仓库使用，发起协同任务。

**工兵（/goutou）**：在每个子仓库使用，响应分配给本仓库的任务。

---

## 一次性安装

### 1. 安装 Skill 文件

```bash
# 在 goutou 仓库根目录执行
mkdir -p ~/.claude/skills/goutou-commander ~/.claude/skills/goutou

cp skills/goutou-commander/SKILL.md ~/.claude/skills/goutou-commander/SKILL.md
cp skills/goutou/SKILL.md ~/.claude/skills/goutou/SKILL.md
```

### 2. 在 Seeder 创建 PAT

1. 登录你的 Seeder 实例
2. 进入 **Settings → API Tokens**
3. 创建 Token：名称随意（如 `claude-mcp`），scope 选 **readwrite**
4. 复制 Token（格式 `seed_pat_…`），只显示一次

### 3. 配置 Seeder MCP

编辑 `~/.claude.json`（全局配置），在 `mcpServers` 中添加：

```json
{
  "mcpServers": {
    "seeder": {
      "type": "http",
      "url": "https://your-seeder.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer seed_pat_your_token_here"
      }
    }
  }
}
```

> 如果 Seeder 在本地开发（`npm run dev`），URL 为 `http://localhost:3000/api/mcp`。

验证：在任意目录打开 Claude Code，输入 `whoami`，应返回你的 Seeder 账号信息。

### 4. 在 Seeder 创建协同中枢项目

在 Seeder UI 里创建一个项目，名称建议：`🧠 协同中枢` 或 `goutou-coord`。

记下 Project ID（URL 里的那串 ID），或直接将项目命名包含 `协同`/`coord`/`goutou` 关键词，军师 skill 会自动发现。

### 5. 配置 goutou 仓库（主控端）

```bash
# 在 goutou 仓库根目录
cp .goutou.example.json .goutou.json
```

编辑 `.goutou.json`：
```json
{
  "coordProjectId": "从 Seeder URL 复制的项目 ID",
  "seederUrl": "https://your-seeder.example.com"
}
```

> `.goutou.json` 已加入 `.gitignore`（含 PAT 信息，不提交）。

### 6. 配置各子仓库（工兵端）

在每个子仓库（contract、sdk、dvt 等）：

**选项 A：子仓库共用全局 MCP 配置（推荐，最省事）**

全局 `~/.claude.json` 里已配置好 Seeder MCP，所有仓库自动可用。无需额外操作。

**选项 B：子仓库独立配置（适用于不同 Seeder 实例）**

在子仓库根目录编辑 `.claude/settings.json`：
```json
{
  "mcpServers": {
    "seeder": {
      "type": "http",
      "url": "https://your-seeder.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer seed_pat_your_token_here"
      }
    }
  }
}
```

在子仓库根目录创建 `.goutou.json`（可选，自动检测也行）：
```json
{
  "repoId": "sdk",
  "coordProjectId": "协同中枢项目 ID"
}
```

> `repoId` 不配置时，工兵自动从 `git remote get-url origin` 提取仓库名。

---

## 日常使用

### 军师：发起协同任务

在 goutou 仓库 Claude Code 里：

```
/goutou-commander 积分系统：合约实现 ERC-20 积分合约并输出 ABI，SDK 封装 mint/burn/balance 接口，App 接入积分展示和兑换页面
```

军师会：
1. 拆解分工（contract → sdk → app 的依赖顺序）
2. 在 Seeder 创建协同任务
3. 打 `repo:contract`、`repo:sdk`、`repo:app` 路由标签
4. 写首条分工评论
5. 输出任务链接和各仓库启动命令

### 工兵：响应协同任务

在各子仓库 Claude Code 里：

```bash
# 单次响应（手动触发）
/goutou

# 定时轮询（每 5 分钟自动检查）
/loop 5m /goutou
```

工兵会：
1. 检测本仓库身份（从 `.goutou.json` 或 git remote 读取）
2. 在 Seeder 搜索 `repo:<本仓库名>` 标记的任务
3. 读取军师分工说明
4. 结合本仓库代码上下文给出技术方案
5. 发布评论（含方案、接口定义、工期、阻塞信息）

### 查看协同进展

打开 Seeder → 协同中枢项目 → 对应任务，即可看到所有仓库的回复线索。

---

## 仓库 ID 约定

| 仓库 | `repoId` | 说明 |
|---|---|---|
| jhfnetboy/contract | `contract` | 智能合约（上游） |
| jhfnetboy/kms | `kms` | 密钥管理 |
| jhfnetboy/dvt | `dvt` | 后端服务 |
| jhfnetboy/sdk | `sdk` | SDK（中游） |
| jhfnetboy/app | `app` | 前端应用（下游） |

`repoId` 默认从 git remote URL 最后一段提取，无需手动配置（除非仓库名与上表不符）。

---

## 路线图

| 阶段 | 功能 | 状态 |
|---|---|---|
| P0 | `/goutou-commander` + `/goutou` skill（搜索路由） | ✅ 当前版本 |
| P1 | Seeder MCP `list-tasks` 加 label 过滤（替代 search 路由） | 🚧 开发中 |
| P2 | 军师收敛汇总（所有工兵回复后自动汇总 + 推进状态） | 📋 计划中 |
| P2 | 自动写入子任务状态（工兵分析完成后更新 Task Status） | 📋 计划中 |

---

## 常见问题

**Q：工兵找不到任务**

检查：
1. 任务评论里有没有 `repos: <repoId> ...` 这行（军师分工评论必须包含）
2. 工兵检测到的 REPO_ID 是否与任务中的 `repo:xxx` 标签匹配（`/goutou` 执行时会输出检测到的 REPO_ID）
3. 协同任务的项目 ID 配置是否正确

**Q：重复回复**

工兵会检查评论中是否已有 `[repo:<REPO_ID>] 工兵回复` 的评论，有则跳过。若确实需要更新，在 Seeder UI 手动删除旧评论后重新触发。

**Q：PAT 权限不足**

标签创建（`create-task-label`）需要协同中枢项目的 owner 或 leader 权限。发评论（`add-task-comment`）只需 member 权限。

确认 Seeder 账号在协同中枢项目中的角色。
