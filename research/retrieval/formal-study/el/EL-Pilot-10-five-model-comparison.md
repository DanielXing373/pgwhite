# EL-Pilot-10 five-model comparison (exploratory)

n=10. Gold is one reader’s labels, not exhaustive truth. Automated Micro-F1 treats Gold extras as false positives even when a Theme is a reasonable reading. **Gold disagreement ≠ semantically unreasonable.** Invalid JSON/IDs are a separate failure mode.

Frozen inputs, prompts, Top20 candidates, and metric definitions were not changed. Numbers are read from immutable `run.json` files.

## Runs

| | GPT-5 mini | GPT-5.2 | DeepSeek Flash | DeepSeek Pro | GPT-6 Luna |
| --- | --- | --- | --- | --- | --- |
| Run ID | EL-P1-GPT5MINI | EL-P1-GPT52 | EL-P1-DSFLASH | EL-P1-DSPRO | EL-P1-GPT6LUNA |
| Model ID | `gpt-5-mini-2025-08-07` | `gpt-5.2-2025-12-11` | `deepseek-flash` | `deepseek-v4-pro` | `gpt-6-luna` |
| Constraint | json_schema · effort low | json_schema · none | json_object · thinking off | json_object · thinking off | json_schema · none |
| `run.json` SHA-256 | `7d1ab53a…e38630` | `020b2604…f742d14` | `56773983…cbc7d6` | `fd1fc69c…2323db` | `04391ab7…04d53db` |
| Valid outputs | 10/10 | 10/10 | 9/10 | 10/10 | 10/10 |

## Aggregate metrics

| Metric | mini | 5.2 | Flash | Pro | Luna |
| --- | --- | --- | --- | --- | --- |
| Micro-F1 (primary) | 0.476 | **0.500** | 0.476 | 0.468 | 0.465 |
| Micro precision | 0.417 (10/24) | 0.400 (12/30) | 0.385 (10/26) | 0.379 (11/29) | 0.400 (10/25) |
| Micro recall | 0.556 (10/18) | 0.667 (12/18) | 0.625 (10/16) | 0.611 (11/18) | 0.556 (10/18) |
| Macro-F1 | 0.542 | 0.558 | 0.552 | 0.508 | 0.525 |
| Exact match | 0/10 | 1/10 | 0/9 valid | 1/10 | 0/10 |
| Zero-theme accuracy | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 |
| Invalid output rate | 0 | 0 | **0.1** | 0 | 0 |
| Retrieval miss | 4 | 4 | 4 | 4 | 4 |
| Selector miss | 4 | 2 | 4 | 3 | 4 |
| False positive (vs Gold) | 14 | 18 | 16 | 18 | 15 |
| Total USD (catalog) | 0.00561 | 0.02541 | 0.00244 | 0.01039 | **0.00122** |
| USD / quote | 0.00056 | 0.00254 | 0.00024 | 0.00104 | 0.00012 |
| Sequential mean latency | 2254 ms | **1033 ms** | 1059 ms | 1294 ms | 1535 ms |
| Sequential P50 / P95 | 2253 / 3484 | 962 / 1487 | 1068 / 1198 | 1319 / 1416 | 1460 / 2820 |
| Wall clock | 22.55 s | 10.34 s | 10.60 s | 12.94 s | 15.35 s |

GPT-5.2 has the highest Micro-F1 on this Gold set and the only OpenAI exact match (`batch2-batch2-022`; Pro matches that Gold set too). Luna is the cheapest catalog estimate. Flash ties mini on Micro-F1 with one invalid row. Differences are small and not statistically identified.

## Quote-level selections (Theme IDs)

Gold empty on `batch1-calib-008` and `batch2-batch2-001` (zero-theme). Flash `batch1-calib-027` is **invalid** (`id_not_in_candidates`: `theme-0124`, `theme-0114`).

| Quote | Gold | mini | 5.2 | Flash | Pro | Luna |
| --- | --- | --- | --- | --- | --- | --- |
| batch1-calib-005 | 时间 | 时间, 珍视 | 时间, 珍视, 理智 | 时间, 珍视, 意义 | 时间, 珍视, 意义 | 时间, 珍视 |
| batch1-calib-001 | 童年, 记忆, 音乐 | 怀旧, 音乐, 童年 | 音乐, 记忆, 怀旧 | 怀旧, 音乐, 记忆 | 怀旧, 音乐, 记忆 | 怀旧, 音乐, 记忆 |
| batch1-calib-008 | (empty) | 孤独, 脆弱, 恐惧 | 孤独, 恐惧, 自然 | 孤独, 恐惧, 脆弱 | 孤独, 恐惧, 脆弱 | 孤独, 自然, 恐惧 |
| batch2-batch2-001 | (empty) | 抛弃, 孤独 | 抛弃, 孤独, 寻找 | 抛弃, 孤独, 失去 | 抛弃, 孤独, 失去 | 文学, 抛弃, 孤独 |
| batch2-batch2-017 | 童年, 痛苦, 幸福 | 童年, 痛苦 | 童年, 痛苦, 脆弱 | 童年, 痛苦, 脆弱 | 童年, 痛苦, 脆弱 | 童年, 痛苦 |
| batch1-calib-027 | 友情, 虚伪 | 背叛, 信任 | 背叛, 信任, 友情 | **INVALID** truncated IDs | 背叛, 信任 | 背叛 |
| batch2-batch2-022 | 父亲, 满足, 亲情 | 亲情, 满足 | 父亲, 亲情, 满足 | 亲情, 父亲, 满足 | 亲情, 父亲, 满足 | 亲情, 满足, 亲密 |
| batch1-calib-006 | 时间, 恐惧 | 时间, 敬畏, 命运 | 时间, 敬畏, 人性 | 时间, 末日, 敬畏 | 时间, 末日, 敬畏 | 时间, 人性, 敬畏 |
| batch2-batch2-023 | 死亡, 生命, 目标 | 死亡, 意义, 自我身份 | 死亡, 意义, 自我身份 | 死亡, 意义, 自我身份 | 死亡, 意义, 自我身份 | 死亡, 意义, 自我身份 |
| batch1-calib-018 | 文学 | 文学, 思考 | 文学, 思考, 语言 | 文学, 思考, 语言 | 文学, 思考, 语言 | 文学, 思考 |

HTML with full Chinese quotes, definitions, and Gold vs 合理/不合理 review: `EL-Five-Model-Theme-Visual-Report.html`.

## Human evaluation

Two-model pack (mini + 5.2, 20 samples, seed 20261021) is unchanged at `archives/EL-human-eval/`.

Five-model pack (50 samples, same seed, including Flash invalid output) is at `archives/EL-human-eval-five-model/`. Public file is blinded. Not scored.
