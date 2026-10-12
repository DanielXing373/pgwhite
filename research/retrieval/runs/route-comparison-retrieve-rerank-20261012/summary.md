# Retrieval run `route-comparison-retrieve-rerank-20261012`

- route: **retrieve-rerank**
- representation: **C**
- provider: `qwen3-embedding` / C:\Users\yuche\.cache\huggingface\hub\models--Qwen--Qwen3-Embedding-0.6B\snapshots\97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3
- git: `3ad99ffe626cdd2c574c377f518a0ee5b2378f60`
- tag library: atomic-tag-library.v1.43 (`a71db8ba7e34…`)
- benchmark: route-comparison-development (`9a73e5a095d5…`)

## Aggregate Metrics

| Metric | Value |
| --- | --- |
| evaluated quotes | 55 |
| skipped (empty expected) | 3 |
| mean Recall@3 | 0.6027 |
| mean Recall@5 | 0.7055 |
| Success@3 (quotes with ≥1 expected Theme in Top 3) | 47/55 (0.8545) |

## Processing Time

| Metric | Value |
| --- | --- |
| mean per-quote tagging time (complete retrieve-rerank route) | 490.88 ms |
| one-time embedding/theme-index preparation | 31227.72 ms |
| one-time route-model preparation | 15285.97 ms |
| estimated 1,000-quote batch time | 537391.76 ms (8.96 min) |

Estimate: embedding/theme-index preparation + route-model preparation + mean per-quote time × 1000. This uses the runner's current sequential processing and excludes human review and external import/network delays.

## Per-Quote

### batch1-calib-001

- expected: ["童年","记忆","音乐"]
- Recall@3/5: 0.3333 / 0.6667
- tagging latency: 15704.86 ms
- reranked candidate pool: 20
- deterministic hits: 童年(canonical:童年), 时间(canonical:时间)

### batch1-calib-002

- expected: ["智慧","语言"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 213.39 ms
- reranked candidate pool: 20
- deterministic hits: 智慧(canonical:智慧), 表达(canonical:表达)

### batch1-calib-003

- expected: ["死亡","轮回"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 213.60 ms
- reranked candidate pool: 20
- deterministic hits: 死亡(canonical:死亡), 轮回(canonical:轮回), 倦怠(canonical:倦怠), 厌恶(canonical:厌恶), 痛苦(alias:苦痛)

### batch1-calib-004

- expected: ["伦理"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 248.30 ms
- reranked candidate pool: 20
- deterministic hits: 伦理(alias:道德)

### batch1-calib-005

- expected: ["时间"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 250.08 ms
- reranked candidate pool: 20
- deterministic hits: 时间(canonical:时间)

### batch1-calib-006

- expected: ["时间","恐惧"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 259.35 ms
- reranked candidate pool: 20
- deterministic hits: 时间(canonical:时间), 性(canonical:性)

### batch1-calib-007

- expected: ["死亡"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 212.42 ms
- reranked candidate pool: 20
- deterministic hits: 死亡(canonical:死亡), 绝望(canonical:绝望), 秩序(canonical:秩序)

### batch1-calib-008

- expected: []
- Recall@3/5: n/a / n/a
- tagging latency: 258.18 ms
- reranked candidate pool: 20
- deterministic hits: 孤独(canonical:孤独)

### batch1-calib-009

- expected: ["记忆","遗忘"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 215.80 ms
- reranked candidate pool: 20
- deterministic hits: 破坏(canonical:破坏), 衰败(alias:衰退), 记忆(canonical:记忆), 性(canonical:性)

### batch1-calib-010

- expected: ["焦虑"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 236.23 ms
- reranked candidate pool: 20
- deterministic hits: 焦虑(alias:不安), 焦虑(canonical:焦虑)

### batch1-calib-011

- expected: []
- Recall@3/5: n/a / n/a
- tagging latency: 260.76 ms
- reranked candidate pool: 20
- deterministic hits: (none)

### batch1-calib-012

- expected: ["满足","占有"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 239.01 ms
- reranked candidate pool: 20
- deterministic hits: 满足(canonical:满足), 占有(alias:掌控)

### batch1-calib-013

- expected: ["死亡"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 224.26 ms
- reranked candidate pool: 20
- deterministic hits: 死亡(canonical:死亡), 身体(canonical:身体)

### batch1-calib-014

- expected: ["观察"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 243.05 ms
- reranked candidate pool: 20
- deterministic hits: 时间(canonical:时间), 观察(canonical:观察)

### batch1-calib-015

- expected: ["废墟","末日"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 232.28 ms
- reranked candidate pool: 20
- deterministic hits: 废墟(canonical:废墟), 城市(canonical:城市)

### batch1-calib-016

- expected: ["好奇"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 211.90 ms
- reranked candidate pool: 20
- deterministic hits: 好奇(alias:好奇心), 好奇(canonical:好奇)

### batch1-calib-017

- expected: ["虚无"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 211.57 ms
- reranked candidate pool: 20
- deterministic hits: 虚无(alias:空虚), 希望(canonical:希望), 生活(canonical:生活)

### batch1-calib-018

- expected: []
- Recall@3/5: n/a / n/a
- tagging latency: 212.28 ms
- reranked candidate pool: 20
- deterministic hits: 文学(alias:阅读), 思考(alias:思想)

### batch1-calib-019

- expected: ["希望"]
- Recall@3/5: 0.0000 / 1.0000
- tagging latency: 211.77 ms
- reranked candidate pool: 20
- deterministic hits: 过去(canonical:过去), 希望(canonical:希望), 当下(alias:现在), 生活(canonical:生活)

### batch1-calib-020

- expected: ["爱情"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 222.44 ms
- reranked candidate pool: 20
- deterministic hits: 幸福(canonical:幸福)

### batch1-calib-021

- expected: ["梦"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 227.07 ms
- reranked candidate pool: 20
- deterministic hits: 梦(alias:梦境), 梦(canonical:梦), 寻找(canonical:寻找)

### batch1-calib-022

- expected: ["时间"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 240.18 ms
- reranked candidate pool: 20
- deterministic hits: (none)

### batch1-calib-023

- expected: ["时间"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 226.44 ms
- reranked candidate pool: 20
- deterministic hits: 过去(canonical:过去), 经历(canonical:经历)

### batch1-calib-024

- expected: ["倦怠"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 226.07 ms
- reranked candidate pool: 20
- deterministic hits: (none)

### batch1-calib-025

- expected: ["财富"]
- Recall@3/5: 0.0000 / 1.0000
- tagging latency: 229.83 ms
- reranked candidate pool: 20
- deterministic hits: 爱情(alias:爱)

### batch1-calib-026

- expected: ["恐惧"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 214.89 ms
- reranked candidate pool: 20
- deterministic hits: 距离(canonical:距离), 爱情(alias:爱)

### batch1-calib-027

- expected: ["友情"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 188.31 ms
- reranked candidate pool: 20
- deterministic hits: (none)

### batch1-calib-028

- expected: ["死亡","名声"]
- Recall@3/5: 0.5000 / 1.0000
- tagging latency: 247.37 ms
- reranked candidate pool: 20
- deterministic hits: 名声(alias:名誉), 名声(alias:荣誉)

### batch1-calib-029

- expected: ["命运"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 213.47 ms
- reranked candidate pool: 20
- deterministic hits: 命运(canonical:命运), 接受(canonical:接受)

### batch2-batch2-001

- expected: ["文学"]
- Recall@3/5: 0.0000 / 1.0000
- tagging latency: 235.44 ms
- reranked candidate pool: 20
- deterministic hits: (none)

### batch2-batch2-002

- expected: ["时间","爱情","文学","思考"]
- Recall@3/5: 0.2500 / 0.2500
- tagging latency: 209.67 ms
- reranked candidate pool: 20
- deterministic hits: 时间(canonical:时间), 爱情(alias:爱), 思考(canonical:思考)

### batch2-batch2-003

- expected: ["目标","生活"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 218.07 ms
- reranked candidate pool: 20
- deterministic hits: 离开(canonical:离开), 生活(canonical:生活)

### batch2-batch2-004

- expected: ["科技"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 213.64 ms
- reranked candidate pool: 20
- deterministic hits: 文学(canonical:文学)

### batch2-batch2-005

- expected: ["人性","科技"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 197.89 ms
- reranked candidate pool: 20
- deterministic hits: (none)

### batch2-batch2-006

- expected: ["人性","选择","智慧"]
- Recall@3/5: 0.3333 / 0.3333
- tagging latency: 201.04 ms
- reranked candidate pool: 20
- deterministic hits: 选择(canonical:选择), 性(canonical:性)

### batch2-batch2-007

- expected: ["命运","接受"]
- Recall@3/5: 0.0000 / 0.5000
- tagging latency: 209.57 ms
- reranked candidate pool: 20
- deterministic hits: (none)

### batch2-batch2-008

- expected: ["自杀","痛苦"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 222.34 ms
- reranked candidate pool: 20
- deterministic hits: 自杀(canonical:自杀), 痛苦(canonical:痛苦), 和平(alias:太平)

### batch2-batch2-009

- expected: ["幸福"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 208.21 ms
- reranked candidate pool: 20
- deterministic hits: 经历(alias:经验), 幸福(canonical:幸福), 平静(alias:安宁), 焦虑(alias:不安), 审美(alias:美), 美好(alias:美好事物), 美好(canonical:美好)

### batch2-batch2-010

- expected: ["幸福","爱情","复杂性"]
- Recall@3/5: 0.3333 / 0.3333
- tagging latency: 232.39 ms
- reranked candidate pool: 20
- deterministic hits: 爱情(alias:爱), 性(canonical:性)

### batch2-batch2-011

- expected: ["智慧","满足","学习","生活"]
- Recall@3/5: 0.2500 / 0.5000
- tagging latency: 203.12 ms
- reranked candidate pool: 20
- deterministic hits: 生活(canonical:生活)

### batch2-batch2-012

- expected: ["孤独","痛苦"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 212.35 ms
- reranked candidate pool: 20
- deterministic hits: 欲望(alias:渴求), 孤独(canonical:孤独), 痛苦(alias:折磨)

### batch2-batch2-013

- expected: ["勇气","意志","恐惧","文学","善恶"]
- Recall@3/5: 0.2000 / 0.2000
- tagging latency: 221.27 ms
- reranked candidate pool: 20
- deterministic hits: 意志(canonical:意志), 旅行(canonical:旅行), 灵魂(canonical:灵魂)

### batch2-batch2-014

- expected: ["时间","死亡","生命","爱情","文学"]
- Recall@3/5: 0.4000 / 0.6000
- tagging latency: 244.88 ms
- reranked candidate pool: 20
- deterministic hits: 死亡(canonical:死亡), 生命(canonical:生命), 爱情(alias:爱), 谎言(canonical:谎言), 信仰(alias:信念)

### batch2-batch2-015

- expected: ["文学","灵魂","身体","复杂性"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 288.10 ms
- reranked candidate pool: 20
- deterministic hits: 灵魂(canonical:灵魂)

### batch2-batch2-016

- expected: ["经历","幸福","生活"]
- Recall@3/5: 0.3333 / 0.6667
- tagging latency: 241.54 ms
- reranked candidate pool: 20
- deterministic hits: 经历(canonical:经历), 幸福(alias:快乐), 爱情(alias:爱), 艺术(alias:文艺), 生活(canonical:生活)

### batch2-batch2-017

- expected: ["童年","幸福","痛苦","复杂性"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 198.94 ms
- reranked candidate pool: 20
- deterministic hits: 童年(alias:孩子), 幸福(canonical:幸福), 痛苦(canonical:痛苦)

### batch2-batch2-018

- expected: ["幸福","痛苦","幽默"]
- Recall@3/5: 0.3333 / 0.3333
- tagging latency: 206.44 ms
- reranked candidate pool: 20
- deterministic hits: 审美(alias:美), 幽默(canonical:幽默)

### batch2-batch2-019

- expected: ["人性","痛苦","目标","复杂性"]
- Recall@3/5: 0.2500 / 0.2500
- tagging latency: 243.34 ms
- reranked candidate pool: 20
- deterministic hits: 性(canonical:性), 牺牲(alias:献身), 目标(alias:追求)

### batch2-batch2-020

- expected: ["时间","观察","当下"]
- Recall@3/5: 0.6667 / 0.6667
- tagging latency: 219.59 ms
- reranked candidate pool: 20
- deterministic hits: 真相(alias:真实), 当下(canonical:当下)

### batch2-batch2-021

- expected: ["人性","死亡","目标","生活","美好"]
- Recall@3/5: 0.4000 / 0.4000
- tagging latency: 240.04 ms
- reranked candidate pool: 20
- deterministic hits: 死亡(canonical:死亡), 生命(canonical:生命), 爱情(alias:爱), 审美(alias:美), 美好(alias:美好事物), 美好(canonical:美好)

### batch2-batch2-022

- expected: ["父亲","满足","亲情","表达","疏离"]
- Recall@3/5: 0.4000 / 0.6000
- tagging latency: 196.97 ms
- reranked candidate pool: 20
- deterministic hits: 父亲(alias:父), 父亲(canonical:父亲), 满足(canonical:满足)

### batch2-batch2-023

- expected: ["时间","死亡","生命","自我身份","目标","生活"]
- Recall@3/5: 0.3333 / 0.3333
- tagging latency: 200.02 ms
- reranked candidate pool: 20
- deterministic hits: 生命(canonical:生命), 自我身份(alias:自我)

### batch2-batch2-024

- expected: ["厌恶","音乐","科技"]
- Recall@3/5: 0.3333 / 0.3333
- tagging latency: 222.87 ms
- reranked candidate pool: 20
- deterministic hits: 音乐(canonical:音乐)

### batch2-batch2-025

- expected: ["幸福","爱情"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 230.63 ms
- reranked candidate pool: 20
- deterministic hits: 幸福(canonical:幸福), 爱情(alias:爱), 爱情(canonical:爱情)

### batch2-batch2-026

- expected: ["责任","罪","宗教"]
- Recall@3/5: 0.3333 / 0.6667
- tagging latency: 195.82 ms
- reranked candidate pool: 20
- deterministic hits: 责任(alias:负责), 救赎(alias:赎罪), 罪(canonical:罪)

### batch2-batch2-027

- expected: ["死亡","记忆","遗忘","孤独","爱情","病态"]
- Recall@3/5: 0.1667 / 0.1667
- tagging latency: 242.38 ms
- reranked candidate pool: 20
- deterministic hits: 遗忘(canonical:遗忘), 牺牲(alias:献身), 当下(alias:现在)

### batch2-batch2-028

- expected: ["混乱","秩序"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 228.50 ms
- reranked candidate pool: 20
- deterministic hits: 混乱(alias:无序), 混乱(canonical:混乱), 秩序(alias:规矩)

### batch2-batch2-029

- expected: ["失去"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 190.73 ms
- reranked candidate pool: 20
- deterministic hits: 失去(canonical:失去), 身体(canonical:身体)

