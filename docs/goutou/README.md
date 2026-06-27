# 狗头军师协同系统

多仓库 Claude Code 协同方案。以 Seeder 看板作为中央任务总线，军师在主控仓库一句话发起跨仓库协同任务，各仓库工兵自动收到分工、结合本仓库代码给出技术方案，替代在多个 terminal 窗口间手工复制粘贴的低效模式。

## 系统架构

```
┌─────────────────────────────────────────────┐
│  goutou 仓库（主控端）                        │
│  Claude Code / /goutou-commander             │
│      ↓ 创建任务 + 打标签 + 写分工             │
│  Seeder 协同面板（http://localhost:7399）      │
│    └─ Project: 协同中枢                       │
│         Task: "积分系统"                      │
│           ├─ label: repo:contract             │
│           ├─ label: repo:sdk                  │
│           ├─ Comment: 军师分工说明             │
│           └─ Comment: [repo:sdk] 工兵回复...  │
└─────────────────────────────────────────────┘
         ↑ MCP (HTTP)      ↑ MCP (HTTP)
┌────────────────┐  ┌────────────────────────┐
│ contract 仓库  │  │ sdk 仓库 Claude Code   │
│ /goutou        │  │ /goutou                │
│ 回复接口方案   │  │ 回复封装方案           │
└────────────────┘  └────────────────────────┘
```

**四个 skill：**

| Skill | 在哪用 | 做什么 |
|---|---|---|
| `/goutou-commander` | goutou 仓库 | 发起多仓库协同任务（军师） |
| `/goutou` | 每个子仓库 | 轮询并响应分配给本仓库的任务（工兵） |
| `/goutou-converge` | goutou 仓库 | 所有工兵回复后汇总并推进任务状态 |
| `/goutou-status` | 任意仓库 | 查看全局进展矩阵（只读） |

---

## 第一步：启动 Seeder 协同面板

Seeder 是协同系统的数据中台，需要先启动它。

```bash
# 在 goutou 仓库根目录
npm run setup        # 首次：生成 .dev.vars + 初始化数据库
npm run dev          # 启动面板
```

面板地址：**http://localhost:7399**（默认端口 7399，避免与 3000/5173/8080 冲突）

> `npm run setup` 会引导你填写管理员邮箱和密码，生成 `.dev.vars` 配置文件。只需运行一次。

---

## 第二步：在面板里完成初始配置

打开 http://localhost:7399，完成以下操作：

### 2a. 注册账号

首次打开会要求注册管理员账号。使用你的邮箱注册即可。

### 2b. 创建协同中枢项目

点击 **New Project**，创建一个项目，名称建议：

```
🧠 协同中枢
```

或任何包含 `协同`/`coord`/`goutou` 关键词的名称（军师 skill 会自动发现）。

记下 URL 里的 Project ID（格式类似 `proj_xxxxxxxx`）。

### 2c. 创建 PAT（Personal Access Token）

进入 **Settings → API Tokens**，点击 **New Token**：

- 名称：`claude-mcp`（或任意名称）
- Scope：**readwrite**（工兵需要发评论）

复制 Token（格式 `seed_pat_…`），**只显示一次，立刻保存**。

---

## 第三步：安装 Skill 文件

```bash
# 在 goutou 仓库根目录执行
mkdir -p ~/.claude/skills/goutou-commander \
         ~/.claude/skills/goutou \
         ~/.claude/skills/goutou-converge \
         ~/.claude/skills/goutou-status

cp skills/goutou-commander/SKILL.md ~/.claude/skills/goutou-commander/SKILL.md
cp skills/goutou/SKILL.md           ~/.claude/skills/goutou/SKILL.md
cp skills/goutou-converge/SKILL.md  ~/.claude/skills/goutou-converge/SKILL.md
cp skills/goutou-status/SKILL.md    ~/.claude/skills/goutou-status/SKILL.md
```

Skill 安装是全局的（`~/.claude/skills/`），在所有仓库的 Claude Code 里都能使用。

---

## 第四步：配置 MCP 连接

编辑 `~/.claude.json`，在 `mcpServers` 字段添加 Seeder：

```json
{
  "mcpServers": {
    "seeder": {
      "type": "http",
      "url": "http://localhost:7399/api/mcp",
      "headers": {
        "Authorization": "Bearer seed_pat_你的token"
      }
    }
  }
}
```

> 如果 Seeder 部署在远端服务器，将 `url` 改为 `https://your-seeder.example.com/api/mcp`。

**验证**：在任意目录打开 Claude Code，输入：

```
调用 Seeder MCP 的 whoami 工具，告诉我当前登录账号
```

应返回你在 Seeder 注册的名称和邮箱。

---

## 第五步：配置 goutou 主控仓库

```bash
# 在 goutou 仓库根目录
cp .goutou.example.json .goutou.json
```

编辑 `.goutou.json`（已加入 `.gitignore`，不会提交）：

```json
{
  "coordProjectId": "proj_xxxxxxxx",
  "seederUrl": "http://localhost:7399"
}
```

> `coordProjectId` 也可以不填，军师会自动搜索名称含 `协同`/`coord`/`goutou` 的项目。

---

## 第六步：配置各子仓库（工兵端）

每个子仓库（contract、sdk、dvt 等）需要能访问 Seeder MCP。

**方案 A：共用全局 MCP（推荐）**

第四步已在 `~/.claude.json` 里配好全局 MCP，所有仓库自动可用，无需额外操作。

**方案 B：子仓库独立配置（多 Seeder 实例场景）**

在子仓库根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "seeder": {
      "type": "http",
      "url": "http://localhost:7399/api/mcp",
      "headers": {
        "Authorization": "Bearer seed_pat_你的token"
      }
    }
  }
}
```

> **安全注意**：`.mcp.json` 可能被 git 追踪。含 PAT 时请加入 `.gitignore`，或将 PAT 放在 `~/.claude.json` 里，`.mcp.json` 只写连接 URL（不含认证信息）。

可选：在子仓库根目录创建 `.goutou.json` 精确指定仓库 ID（不配置时自动从 git remote 提取）：

```json
{
  "repoId": "sdk",
  "coordProjectId": "proj_xxxxxxxx"
}
```

---

## 日常使用

### 军师发起协同任务

在 **goutou 仓库**的 Claude Code 里：

```
/goutou-commander 积分系统：合约实现 ERC-20 积分合约并输出 ABI，SDK 封装 mint/burn/balance 接口，App 接入积分展示和兑换页面
```

军师自动完成：
1. 分析涉及仓库和依赖顺序（contract → sdk → app）
2. 在 Seeder 创建协同任务，description 写入 `repo:contract repo:sdk repo:app`（工兵搜索路由）
3. 创建并打上 `repo:*` 标签（用于 P1 精确过滤）
4. 写首条分工评论（各仓库具体分工说明）
5. 输出面板链接和各仓库启动命令

在面板（http://localhost:7399）可以实时查看任务。

### 工兵响应协同任务

在**每个子仓库**的 Claude Code 里：

```bash
# 手动单次响应
/goutou

# 定时轮询（每 5 分钟检查一次，有任务立即响应）
/loop 5m /goutou
```

工兵自动完成：
1. 检测本仓库 ID（从 `.goutou.json` 或 git remote 读取）
2. 查找 Seeder 中分配给本仓库的协同任务
3. 读取军师分工说明
4. 结合本仓库代码给出技术方案
5. 发布工兵回复评论（方案 + 接口定义 + 工期 + 阻塞信息）

### 军师收敛汇总

所有工兵都回复后，在 **goutou 仓库**里：

```bash
# 手动收敛
/goutou-converge

# 定时收敛（每 30 分钟检查一次）
/loop 30m /goutou-converge
```

收敛自动完成：
1. 扫描所有工兵都已回复的任务
2. 生成汇总评论（方案要点 + 接口定义 + 执行路径 + 风险点）
3. 将任务状态推进至"进行中"

### 查看全局进展

```bash
# 在任意仓库
/goutou-status
```

输出进展矩阵，显示每个协同任务中哪些仓库已响应、哪些在等待、是否已汇总。

也可直接打开面板：http://localhost:7399 → 协同中枢项目 → 对应任务查看详细评论。

---

## 仓库 ID 约定

| 仓库 | `repoId` | 说明 |
|---|---|---|
| jhfnetboy/contract | `contract` | 智能合约（上游） |
| jhfnetboy/kms | `kms` | 密钥管理 |
| jhfnetboy/dvt | `dvt` | 后端服务 |
| jhfnetboy/sdk | `sdk` | SDK（中游） |
| jhfnetboy/app | `app` | 前端应用（下游） |

`repoId` 默认从 git remote URL 最后一段提取，无需手动配置（除非目录名与仓库名不符）。

---

## 功能路线图

| 阶段 | 功能 | 状态 |
|---|---|---|
| P0 | `/goutou-commander` + `/goutou`（description 路由） | ✅ 已完成 |
| P1 | `list-tasks labelName` 过滤 + `read-task` 返回 labels | ✅ 已完成 |
| P2 | `/goutou-converge` 汇总 + 状态推进 | ✅ 已完成 |
| P2 | `/goutou-status` 全局进展矩阵 | ✅ 已完成 |
| P3 | CLAUDE.md snippet + 子仓库 docs | ✅ 已完成 |
| 未来 | 工兵完成后自动标记 doing→done | 📋 计划中 |
| 未来 | `/loop` 配置持久化到 CLAUDE.md | 📋 计划中 |

---

## 常见问题

**Q：工兵找不到任务**

1. 打开面板确认任务的 **description 字段** 里有 `repo:<repoId>`（如 `repo:sdk`）——路由标记必须在描述里，不在评论里
2. 工兵输出的 REPO_ID 是否与描述里的 token 完全一致（大小写敏感）
3. `.goutou.json` 里的 `coordProjectId` 是否指向正确的协同中枢项目

**Q：工兵重复回复**

工兵会检查是否已有 `[repo:<REPO_ID>] 工兵回复` 评论，有则跳过。若需重新响应，在面板手动删除旧评论后再触发。

**Q：标签创建失败**

标签管理需要协同项目的 `taxonomy.manage` 权限（默认 owner/leader 有）。评论发布只需 member 权限。在面板 → 协同中枢项目 → 成员管理 里确认角色。

**Q：Seeder 面板访问不了**

确认 `npm run dev` 在 goutou 目录正在运行，然后访问 http://localhost:7399。如果端口被占用，可以用 `PORT=7400 npm run dev` 临时换端口。

**Q：MCP 连接失败**

在 Claude Code 里输入「调用 Seeder MCP 的 whoami 工具」，若返回错误：
- 检查 `~/.claude.json` 里的 URL 和 PAT 是否正确
- 确认 Seeder 面板正在运行（http://localhost:7399 能打开）
- 确认 PAT 的 scope 是 `readwrite`
