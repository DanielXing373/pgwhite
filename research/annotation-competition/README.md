# 自动标注内部竞赛（AC1）

目标：让中国用户的大批量阅读摘抄（1,000–10,000 条）能被**快速、便宜、合理**地自动标注，覆盖三个维度：主题、修辞、描写手法。本目录是研究代码，不写生产库、不改线上代码、不改已冻结的 EL1/EL2 文件。

流程：**内部竞赛（本目录）→ 盲审计分 → 前几名组合再上真人问卷**。

## 为什么重做一套

审查 EL1/EL2 的结论（数字来自 58 条开发集）：

- 纯 Embedding 不能当最终标注器：Top2 的 F1 只有 0.36，相似度分不开对错，也无法弃答。
- Top20 + LLM 的 F1 约 0.57，但 115 个人工标签里有 24 个不在 Top20 里，模型看不到。
- 185 个主题的名称加定义只有约 3,400 字，可以整库放进 prompt，不需要检索。
- DeepSeek Flash 的 7 条无效输出全是 ID 后缀被截断（`theme-0198` 而不是完整 ID），是 ID 设计问题。本目录改用短编号（`T001`、`R01`、`D01`），本地映射回 ID。
- “0–2 个”的提示不会让模型弃答。本目录改为不设上限，但每个标签必须附原文证据，本地校验证据确实出现在摘抄里，否则丢弃。
- 人工 gold 是单人标注。本目录不把它当标准答案，而是当作盲审里的一个匿名来源。

## 标签库 `library/tag-library.ac1.json`

由 `scripts/build-library.mjs` 从冻结的 v1.43 本体生成（校验 SHA-256，只读）。

| 维度 | 数量 | 说明 |
| --- | ---: | --- |
| 主题 theme | 185 | 原样沿用，ID 不变 |
| 修辞 rhetoric | 15 | 比喻、拟人、夸张、排比、对比、反讽、反问、设问、借代、双关、通感、象征、重复、引用、拟声 |
| 描写手法 technique | 9 | 外貌、语言、动作、心理、环境、细节描写，白描，侧面描写，留白 |

原 31 个 device 的清理决定（2026-11-12 人工确认）记录在库文件的 `cleanup` 字段里：隐喻→比喻、对比描写→对比、通篇象征→象征；删除头韵、内涵、暗示、意象、长句描写；新增语言描写。线上“隐喻→比喻”的迁移不在本研究范围内。

## 数据集

| ID | 条数 | 用途 |
| --- | ---: | --- |
| `dev58` | 58 | 冻结 benchmark。参与过标签库修订，只当开发集 |
| `holdout60` | 60 | `scripts/sample-holdout.mjs` 从 1169 条个人摘录按书分层抽取（seed 20261112），排除与 dev58 重复的句子。**最终排名以它为准，不要根据它改 prompt 或标签库** |

数据集只把 `quote_id` 和原文交给运行器，人工标签不会进入 prompt。

## 参赛组合（`configs/`）

一个组合 = 模型 × 候选范围（`top20` / `full`）× 每次请求条数 × 是否要求证据 × 维度 × 调用方式（`joint` 一次出三个维度 / `separate` 每个维度一次）。

| 轮次 | 配置 | 比什么 |
| --- | --- | --- |
| 1 | `R1-luna-*`（6 个，只做主题，dev58） | 候选范围 × 每次条数 × 证据 |
| 2 | `R2-luna-joint`、`R2-luna-separate` | 三个维度合并调用还是分开调用 |
| 3 | `R3-*` | 换 DeepSeek Flash；在 holdout60 上定最终排名 |

第 2、3 轮的配置暂按“全库 / 每次 20 条 / 要证据”写，**第 1 轮出结果后按胜出写法修改再跑**。`top20` 只在 dev58 上有冻结的检索结果。

非 LLM 基线和历史结果由 `scripts/make-baseline-runs.mjs` 转成同一种 run 格式（只有主题维度）：Embedding Top2、人工标注、EL2 的 Luna 和 Flash。

## 评分：盲审

1. 把参赛组合对同一条摘抄给出的标签合并、去重、打乱，生成盲审包。公开包里没有来源、模型、顺序、证据。
2. 评审在 `review/index.html` 里逐个判“合适 / 不合适”，导出判定文件。
3. 用判定给所有组合计分。之后新增组合时，带上已有判定重新生成盲审包，只需补判新出现的标签。

指标：

- **认可率**：该组合给出的标签里被判合适的比例。
- **覆盖率**：所有被判合适的标签里，该组合给出了多少。它相对于本次的合并标签池，不是绝对召回率。
- **第 1/2/3 个标签的认可率**：用来决定线上截断到第几个。
- **留空正确**：某个维度所有标签都被判不合适的摘抄里，该组合是否正确地什么都没给。
- **无效句比例**、**元/万条**（按价格表和实际 token 估算，不是账单）、**秒/万条**（按本次并发实测外推）。

排名规则：先设质量门槛，过线的组合按成本排序，前三上问卷。门槛在第 1 轮结果出来后由项目负责人定。

## 命令

所有命令在仓库根目录执行。付费调用由项目负责人在本机执行。

```powershell
# 测试（离线，不发请求）
node --test research/annotation-competition/tests/*.test.mjs

# 1. 看计划和 prompt（默认 dry-run：不发请求、不写文件）
node research/annotation-competition/scripts/run-arm.mjs --config research/annotation-competition/configs/R1-luna-full-b20-ev.json --show-prompt

# 2. 冒烟：只跑前 3 条（付费，约不到 1 分钱）
$env:OPENAI_API_KEY = "<只在当前 shell 设置>"
node research/annotation-competition/scripts/run-arm.mjs --config research/annotation-competition/configs/R1-luna-full-b20-ev.json --execution-mode paid-api --allow-paid-api --limit 3 --run-id R1-luna-full-b20-ev-SMOKE

# 3. 正式跑第 1 轮（6 个组合各跑一次，run-id 用配置名）
node research/annotation-competition/scripts/run-arm.mjs --config research/annotation-competition/configs/R1-luna-full-b20-ev.json --execution-mode paid-api --allow-paid-api --run-id R1-luna-full-b20-ev

# 4. 生成基线 run（不调用模型）
node research/annotation-competition/scripts/make-baseline-runs.mjs

# 5. 生成盲审包
node research/annotation-competition/scripts/build-review-pack.mjs --out-name round1-dev58 `
  --run BASE-embedding-top2-dev58 --run BASE-human-gold-dev58 --run LEGACY-EL2-GPT6LUNA --run LEGACY-EL2-DSFLASH `
  --run R1-luna-top20-b1-noev --run R1-luna-top20-b1-ev --run R1-luna-full-b1-noev --run R1-luna-full-b1-ev --run R1-luna-full-b20-noev --run R1-luna-full-b20-ev

# 6. 浏览器打开 research/annotation-competition/review/index.html，载入 packs/round1-dev58.public.json，
#    判完后导出，把文件放到 packs/ 下

# 7. 计分（--run 列表同第 5 步）
node research/annotation-competition/scripts/score.mjs --judgments research/annotation-competition/packs/judgments-dev58-<pack_id>.json --out research/annotation-competition/packs/round1-dev58.report.md --run ...
```

DeepSeek 组合需要 `$env:DEEPSEEK_API_KEY`。

安全约定（沿用 formal-study）：

- 默认 dry-run；付费必须同时给 `--execution-mode paid-api` 和 `--allow-paid-api`。
- `max_requests` 是发请求前的硬上限；`max_estimated_budget_usd`（1 美元）是事后估算的止损线。
- run 目录不可覆盖，重跑要换 `--run-id`。带 `--limit` 的冒烟 run 不能进盲审包。
- 无效输出、被丢弃的标签都如实记录，不修复。

## 版本控制

- 本目录全部是新增文件，没有修改任何已跟踪文件。
- `runs/` 和 `packs/` 被本目录的 `.gitignore` 忽略：模型原始输出、盲审包、判定文件留在本机。
- 复用了 `research/retrieval/formal-study/runner/src/` 里的 `selector/http.mjs`、`cost.mjs`、`safety.mjs` 和 `pricing/pricing-catalog.v1.json`（只 import）。
- 测试没有接进根目录的 `pnpm test`（那需要改 `package.json`）。

## 已知限制

- 盲审只有一位评审，判定带有个人偏好；真人问卷阶段再做多人验证。
- 每次请求 20 条时可能出现串题或质量下降，第 1 轮专门对比。
- 缓存命中率和 DeepSeek 的 JSON 稳定性要看实测；成本是按价格表估算的。
- 冻结库里少数主题定义带内部备注（如“高复用关系概念”），本轮为了保持主题库不变没有清理。
