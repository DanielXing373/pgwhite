# PGWhite — 给 Claude Code 的工作说明

PGWhite（鸽白词句库）是一个多维度的阅读摘抄库：按作者书籍、主题、修辞、描写手法等维度分类。Nuxt 应用部署在 Vercel，MySQL 在 Railway。项目负责人是 Daniel，用中文沟通。

产品概念以 `docs/README.md` 列出的 Product Model 和 ADR 为准；本文件只管工作规则和当前任务。

## 必须遵守的规则

1. **不要 commit，不要 push。** 提交和推送由 Daniel 自己做。你可以建议提交信息。
2. **付费模型调用前必须先问。** 任何 `--execution-mode paid-api` 的命令，先说明要跑什么、多少次请求、预计多少钱，得到同意后再执行。dry-run、假接口和测试可以直接跑。
3. **改文件前先确认范围。** 当前已获许可的范围只有 `research/annotation-competition/`。动这个目录以外的任何文件（包括 `package.json`、线上代码、数据库迁移）之前先问。
4. **不要动已冻结的研究产物。** `research/retrieval/formal-study/` 下的 EL1、EL2 的 run、archive、benchmark、ontology、配置都是只读的。可以读、可以 import 那里的工具模块，不能改。
5. **不要写生产数据库。** 不跑迁移，不改 `quote_tags`。`.env` 里是数据库口令，不要打印或复制它的内容。
6. **不要打印任何 API key。** 检查 key 是否存在时只显示变量名。
7. **有疑问先问。** 影响方案、成本、数据的决定不要自己默默定。
8. **版本控制要干净。** 新工作在 `research/annotation-competition` 分支上进行，需要新分支就提出来，不影响之前的分支。

## 当前任务：自动标注内部竞赛（AC1）

**最终目标**：让中国用户的大批量阅读摘抄（1,000–10,000 条）能被快速、便宜地自动标注，输出合理，覆盖三个维度：主题、修辞、描写手法（暂定）。

**流程**：内部竞赛 → Daniel 盲审计分 → 前几名组合再上真人问卷。问卷（`/el2test` 的后续）现在先不管。

方案、指标、命令全部写在 `research/annotation-competition/README.md`，开始工作前先读它。

### 已经确定的结论（不要重新争论）

- 纯 Embedding 不能当最终标注器，只保留为基线和检索、去重用途。判断“标签是否成立”这一步现阶段用 LLM。
- 185 个主题整库放进 prompt，不再走 Top20 检索；Top20 只作为第 1 轮的对照组。
- 模型看短编号（`T001`、`R01`、`D01`），本地映射回 ID。
- 标签数量不设上限，但每个标签必须附原文证据，本地校验后不合格的丢弃，不修复。
- 人工 gold 是单人标注，可能有偏，只作为盲审里的一个匿名来源，不是标准答案。
- 标签库：主题 185（原样），修辞 15，描写手法 9。清理决定记录在 `library/tag-library.ac1.json` 的 `cleanup` 字段。线上已有标注有备份，暂不考虑迁移。
- 参赛模型暂定 GPT-6 Luna 和 DeepSeek Flash。
- 成本是硬约束：每个用户花几十元整理库不可接受。批处理（每次请求多条）和“同一句只标一次”是主要的省钱手段。
- `dev58` 只当开发集；`holdout60` 是验证集，最终排名以它为准，**不要根据它改 prompt 或标签库**。

### 当前进度

- 竞赛框架已写完，21 个离线测试通过：`node --test research/annotation-competition/tests/*.test.mjs`
- 基线 run（Embedding Top2、人工标注、EL2 的 Luna 和 Flash）已生成在 `runs/`。
- **卡在冒烟测试**：第一次付费冒烟没有发出请求，因为运行命令的 PowerShell 窗口里没有 `OPENAI_API_KEY`。Daniel 说 key 存成了 Windows 本地环境变量，需要确认变量名和作用域。脚本也支持从仓库根目录 `.env` 读取 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`（目前 `.env` 里没有这两项）。
- 真实的 OpenAI 和 DeepSeek 接口还从未调通过。最可能出问题的是 OpenAI 对严格 JSON schema 的校验（三个维度共 209 个枚举值）。
- 盲审页面 `review/index.html` 只做过语法检查，没在浏览器里实际操作过。

### 下一步

1. 确认 key 可用（只显示变量名）：
   `Get-ChildItem Env: | Where-Object Name -match 'OPENAI|DEEPSEEK' | Select-Object Name`
2. 征得同意后跑 3 条冒烟：
   `node research/annotation-competition/scripts/run-arm.mjs --config research/annotation-competition/configs/R1-luna-full-b20-ev.json --execution-mode paid-api --allow-paid-api --limit 3 --run-id R1-luna-full-b20-ev-SMOKE2`
   通过标准：HTTP 200，3 条都是 valid，token 数和成本非空。检查证据是否真的是原文片段。
3. 征得同意后跑第 1 轮的 6 个配置（`configs/R1-luna-*.json`，共约 240 次请求，run-id 用配置名）。
4. 生成盲审包，Daniel 在 `review/index.html` 里判定并导出。
5. 计分，和 Daniel 一起定质量门槛，按第 1 轮胜出的写法修改 `R2-*`、`R3-*` 配置后再跑。

### 约定

- run 目录不可覆盖，重跑换 `--run-id`。带 `--limit` 的冒烟 run 不能进盲审包。
- `runs/` 和 `packs/` 被忽略，不进 git。里面的 `SELFTEST*` 和失败的 `R1-luna-full-b20-ev-SMOKE` 是可以删除的自测残留。
- 无效输出和被丢弃的标签如实记录，不要为了让数字好看而修复。
- 改 prompt 要升 `PROMPT_VERSION`（`src/prompt.mjs`），改标签库要改 `scripts/build-library.mjs` 后重新生成并升版本号。
- 向 Daniel 汇报时先说结论和数字，说明哪些是实测、哪些是推断。

## 常用命令

```powershell
pnpm test                                                        # 仓库原有测试
node --test research/annotation-competition/tests/*.test.mjs     # 竞赛目录测试（未接入 pnpm test）
node research/annotation-competition/scripts/run-arm.mjs --config <配置> --show-prompt   # dry-run
```
