# 狗头守夜职能文档 / Goutou Watch Job Description

> 本文档定义 goutou 仓库作为「管家」的核心工作职能。
> 对应角色：Brood = 大脑（生态 Orchestrator），goutou = 管家（任务总线 + 持续监控）

---

## 职能定位

goutou 是 Mycelium 生态的**任务执行中台**，负责：

1. **持续监控**：24/7 监测各生态仓库的 Release、Breaking Change、接口变更
2. **跨仓库协作**：接收军师需求 → 分发任务 → 汇总工兵回复 → 推进执行
3. **上下游通知**：变化发生时，自动通知受影响的上下游仓库

---

## 启动方式

在 goutou 仓库目录下，进入 Claude Code 后执行：

```bash
/loop /goutou-watch
```

启动后持续运行，直到手动关闭 Claude Code。无需其他操作。

---

## 三类变化监测

| 类型 | 定义 | 检测方式 | 通知对象 |
|---|---|---|---|
| **New Release** | 发布新 tag/GitHub Release | `gh release list` 对比 state | 所有 downstream 仓库 |
| **Breaking Change** | commit 含 `!:` / `BREAKING CHANGE`，或 PR label `breaking-change` | git log + gh pr list | 所有 downstream 仓库（高优先级） |
| **接口变更建议** | Brood `/sync-context-reverse` 检测到接口 diff | 读 `~/Dev/Brood/orgs/*/INTERFACES.md` 修改时间 | 受影响 downstream 仓库 |

---

## Push vs Pull 双通道

```
Pull（goutou 主动拉）            Push（仓库主动推）
─────────────────────           ──────────────────────
/loop /goutou-watch             子仓库完成工作后
每 15-30 min 轮询               手动运行 /goutou
GitHub Releases + Brood         发布进度更新评论到 Seeder
↓                               ↓
去重（对比 state 文件）          去重（检查已有评论）
↓                               ↓
相同 → 跳过（零 token 消耗）    已回复 → 跳过
不同 → 创建 Seeder 通知任务
```

---

## 依赖关系图（核心路径）

```
air-contract ──→ airaccount ──→ relay ──→ paymaster ──→ aastar-sdk ──→ cos72 ──→ cityos
                                          │                        ──→ sin90 ──→ cityos
                                          └──→ idoris ──→ sin90
                                          └──→ launch
                     comet ──────────────→ aastar-sdk
                   agent24 ──────────────→ sin90
                      pnts ──────────────→ cos72, sin90, launch
```

权威来源：`.goutou-deps.json`（本仓库）
原始来源：`~/Dev/Brood/docs/ECOSYSTEM_MAP.md`（不重复维护，按需更新 deps.json）

---

## 跨仓库协作全流程

```
Step 1  军师发起     /goutou-commander "需求"
          ↓
Step 2  工兵发现     子仓库 /loop /goutou（轮询）或完成后手动 /goutou（推送）
          ↓
Step 3  首轮回复     [repo:sdk] 工兵回复 - 方案 + 接口 + 工期 + 阻塞
          ↓
Step 4  军师收敛     /goutou-converge 或 /goutou-watch 内联执行
          ↓
Step 5  工兵执行     各仓库自行开发
          ↓ (遇到阻塞)
Step 6  求助响应     [repo:sdk] 进度更新 - 阻塞 @repo:contract
          ↓
Step 7  被@仓库响应  /goutou 检测 @-mention → [repo:contract] 协助回复
          ↓
Step 8  最终完成     [repo:sdk] 完成 - v0.5.0 已发布
          ↓
Step 9  军师收尾     /goutou-converge 发最终汇总，任务 → Done
```

---

## 状态文件

`.goutou-watch-state.json`（本仓库根目录，不提交 git）：

```json
{
  "lastCheck": "2026-06-27T10:00:00Z",
  "lastBroodSync": "2026-06-27T09:00:00Z",
  "repos": {
    "aastar-sdk": {
      "lastRelease": "v0.24.0",
      "lastReleaseAt": "2026-06-20T00:00:00Z",
      "lastCheckAt": "2026-06-27T10:00:00Z"
    }
  },
  "notified": [
    "aastar-sdk@v0.24.0",
    "paymaster@v5.5.0"
  ]
}
```

`notified` 数组防止重复通知。重置方法：删除文件或清空 `notified` 数组。

---

## 自我改进规则

> 每次出错后记录，下次检查是否改进：

| 问题 | 根因 | 修复方式 | 验证时机 |
|---|---|---|---|
| 重复通知 | state 文件未更新 | Step 7 必须在 MCP 写入成功后才更新 state | 下次同一版本出现 |
| 找不到工兵任务 | REPO_ID 大小写不一致 | Step 0 强制 toLowerCase() | 下次 /goutou 运行 |
| 分工评论匹配失败 | heading 被 Seeder 剥离 | 只匹配纯文字 `各仓库分工` 和 `repo:<ID>` | 下次新任务 |
| gh CLI 无权限 | 私有仓库未授权 | 跳过并记录，不中断循环 | 下次 watch 运行 |

---

## 相关文件

| 文件 | 用途 |
|---|---|
| `docs/goutou/REPO-IDS.md` | 仓库简称注册表（权威源） |
| `.goutou-deps.json` | 依赖关系图（路由用） |
| `.goutou-watch-state.json` | 运行时状态（dedup 用，不提交） |
| `.goutou.json` | 本仓库配置（coordProjectId 等） |
| `skills/goutou-watch/SKILL.md` | 守夜 skill |
| `skills/goutou/SKILL.md` | 工兵 skill（含 @-mention 响应） |
| `skills/goutou-commander/SKILL.md` | 军师 skill |
| `skills/goutou-converge/SKILL.md` | 收敛 skill |
| `~/Dev/Brood/docs/ECOSYSTEM_MAP.md` | 生态地图（依赖图原始来源） |
