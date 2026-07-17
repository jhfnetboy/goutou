# 狗头工兵配置（子仓库 CLAUDE.md 片段）

将以下内容添加到子仓库的 CLAUDE.md。

---

## 狗头协同（Goutou Multi-Repo Coordination）

This repo participates in the Goutou coordination system. Config is in `.goutou.json` (gitignored).

### Skills（全局已安装，直接用）

```bash
/goutou                   # 查看并回复分配给本仓库的协同任务（单次）
/loop 5m /goutou          # 每 5 分钟自动轮询
/goutou-commander <需求>  # 发起跨仓库协同任务（任意仓库均可）
/goutou-status            # 查看全局任务状态矩阵（只读）
```

### 前置条件（已满足）

- `seeder` MCP 已在 `~/.claude.json` 全局配置
- `.goutou.json` 已在本仓库根目录（含 `coordProjectId`）
- 所有 skill 已安装至 `~/.claude/skills/`

### 协同流程

1. 任意仓库 `/goutou-commander <需求>` → Seeder 创建任务并路由到相关仓库
2. 各仓库 `/loop 5m /goutou` → 自动发现并回复任务
3. `/goutou-converge`（在 goutou 仓库）→ 汇总结论、更新任务状态
