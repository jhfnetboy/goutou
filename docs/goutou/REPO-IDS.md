# 仓库简称注册表 / Repo ID Registry

> 权威来源：本文件。goutou-watch / goutou-commander / .goutou-deps.json 均从此读取。
> 子仓库在 `.goutou.json` 中用 `repoId` 字段设置自己的简称，必须与本表一致。
> 每个 REPO_ID 全小写，用于 Seeder 标签 `repo:<ID>` 和评论 `@repo:<ID>`。

---

## AAStarCommunity（区块链基础设施）

| REPO_ID | GitHub 仓库 | 本地路径 | 十词定位 |
|---|---|---|---|
| `kms` | AAStarCommunity/AirAccount | `~/Dev/aastar/AirAccount` | TEE账户·指纹登录·无私钥 |
| `contract` | AAStarCommunity/airaccount-contract | `~/Dev/aastar/airaccount-contract` | AirAccount链上合约 |
| `sp` | AAStarCommunity/SuperPaymaster | `~/Dev/aastar/SuperPaymaster` | Gas抽象·多角色·信用体系 |
| `relay` | AAStarCommunity/super-relay | `~/Dev/aastar/super-relay` | ERC-4337企业级Bundler网关 |
| `ultrarelay` | AAStarCommunity/UltraRelay-AAStar | `~/Dev/aastar/UltraRelay-AAStar` | Alto fork·aastar-dev分支 |
| `sdk` | AAStarCommunity/aastar-sdk | `~/Dev/aastar/aastar-sdk` | 开发者SDK·封装AAstar全栈 |
| `yaa` | AAStarCommunity/YetAnotherAA | `~/Dev/aastar/YetAnotherAA` | AL Account实现 |
| `docs` | AAStarCommunity/aastar-docs | `~/Dev/aastar/aastar-docs` | SDK文档站 |
| `abi-docs` | AAStarCommunity/abi-docs-kit | `~/Dev/aastar/abi-docs-kit` | ABI文档生成工具 |
| `registry` | AAStarCommunity/registry | `~/Dev/aastar/registry` | 注册表服务 |

## AuraAIHQ（AI基础设施）

| REPO_ID | GitHub 仓库 | 本地路径 | 十词定位 |
|---|---|---|---|
| `agent24` | AuraAIHQ/Agent24 | `~/Dev/auraai/Agent24` | 个人AI Agent框架·AgentStore |
| `idoris` | AuraAIHQ/iDoris | `~/Dev/auraai/iDoris` | 隐私优先·边缘计算·AI模型 |
| `idoris-sdk` | AuraAIHQ/iDoris-SDK | `~/Dev/auraai/iDoris-SDK` | 微信Agent SDK |
| `aura-pkg` | AuraAIHQ/auraai-packages | `~/Dev/auraai/auraai-packages` | AuraAI共享包 |
| `speaker` | AuraAIHQ/agent-speaker | `~/Dev/auraai/agent-speaker` | Nostr通信层 |
| `social` | AuraAIHQ/AgentSocial | `~/Dev/auraai/AgentSocial` | Agent社交协议 |

## MushroomDAO（社区·个人·城市OS）

| REPO_ID | GitHub 仓库 | 本地路径 | 十词定位 |
|---|---|---|---|
| `cos72` | MushroomDAO/Cos72 | `~/Dev/mycelium/Cos72` | 社区OS·Onboarding·激励治理 |
| `sin90` | MushroomDAO/Sin90 | `~/Dev/mycelium/Sin90` | 个人OS·表达·创作·建设者 |
| `cityos` | MushroomDAO/CityOS | `~/Dev/mycelium/CityOS` | AI+Blockchain城市操作系统 |
| `comet` | MushroomDAO/CometENS | `~/Dev/mycelium/CometENS` | 免费子域名服务 |
| `pnts` | MushroomDAO/OpenPNTs | `~/Dev/mycelium/OpenPNTs` | 积分协议 |
| `park` | MushroomDAO/Park | `~/Dev/mycelium/Park` | 数字公共物品协议 |
| `spores` | MushroomDAO/Spores | `~/Dev/mycelium/Spores` | 可持续协作协议 |
| `launch` | MushroomDAO/launch | `~/Dev/mycelium/launch` | Phase1 Genesis Launch |
| `myshop` | MushroomDAO/MyShop | `~/Dev/mycelium/MyShop` | 社区商店 |
| `mytask` | MushroomDAO/MyTask | `~/Dev/mycelium/MyTask` | 社区任务 |
| `myvote` | MushroomDAO/MyVote | `~/Dev/mycelium/MyVote` | 社区治理投票 |
| `mynft` | MushroomDAO/MyNFT | `~/Dev/mycelium/MyNFT` | NFT模块 |
| `listener` | MushroomDAO/Listener | `~/Dev/mycelium/Listener` | AI Native Entrance |
| `expresser` | MushroomDAO/Expresser | `~/Dev/mycelium/Expresser` | 个人表达工具 |

## 特殊仓库

| REPO_ID | 本地路径 | 定位 |
|---|---|---|
| `brood` | `~/Dev/Brood` | 生态大脑·Orchestrator·依赖图权威源 |
| `goutou` | `~/Dev/jhfnetboy/goutou` | 管家·任务总线·协同调度 |
| `pr-daemon` | `~/Dev/tools/pr-daemon` | PR-review 引擎·三轮PK·RC 路由回原仓库工兵（见 docs/goutou/PR-REVIEW.md） |

---

## 子仓库配置示例

在各子仓库根目录创建 `.goutou.json`（已加入 `.gitignore`）：

```json
{
  "repoId": "aastar-sdk",
  "coordProjectId": "03253073-c822-4a5a-b169-cb39976200c3"
}
```

REPO_ID 必须与本表 `REPO_ID` 列完全一致（小写，连字符）。
