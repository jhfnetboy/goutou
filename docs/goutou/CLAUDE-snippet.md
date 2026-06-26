# 狗头工兵配置（子仓库 CLAUDE.md 片段）

将以下内容添加到子仓库的 CLAUDE.md（如 `contract/CLAUDE.md`、`sdk/CLAUDE.md` 等）。

---

## 狗头协同（Goutou Soldier）

This repo participates in the Goutou multi-repo coordination system as a **soldier**.

**REPO_ID**: `<填入仓库名，如 sdk>`（auto-detected from git remote if not set in `.goutou.json`）

### Soldier skill

```bash
/goutou                  # check once for assigned coord tasks and reply
/loop 5m /goutou         # auto-poll every 5 min
/goutou-status           # view status matrix of all coord tasks (read-only)
```

### MCP setup (one-time)

Add to `~/.claude.json` → `mcpServers`:
```json
"seeder": {
  "type": "http",
  "url": "https://your-seeder.example.com/api/mcp",
  "headers": { "Authorization": "Bearer seed_pat_…" }
}
```

Get the PAT from the Seeder instance owner (Settings → API Tokens, readwrite scope).

### Local config (optional)

Create `.goutou.json` in this repo root (gitignored):
```json
{
  "repoId": "<仓库名>",
  "coordProjectId": "<协同中枢项目ID>"
}
```

Install the skills:
```bash
mkdir -p ~/.claude/skills/goutou ~/.claude/skills/goutou-status
cp <goutou-repo>/skills/goutou/SKILL.md ~/.claude/skills/goutou/SKILL.md
cp <goutou-repo>/skills/goutou-status/SKILL.md ~/.claude/skills/goutou-status/SKILL.md
```
