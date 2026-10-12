# Retrieval run `calib-qwen06b-v142-20261011-C`

- representation: **C**
- provider: `qwen3-embedding` / Qwen/Qwen3-Embedding-0.6B
- git: `3ad99ffe626cdd2c574c377f518a0ee5b2378f60`
- tag library: atomic-tag-library.v1.42 (`919ab109bebb…`)
- benchmark: calib-zh-themes.v1.42-review-draft (`401e15086eb0…`)

## Aggregate Recall

| Metric | Value |
| --- | --- |
| evaluated quotes | 26 |
| skipped (empty expected) | 3 |
| mean Recall@5 | 0.7308 |
| mean Recall@10 | 0.8654 |
| mean Recall@20 | 0.9038 |

## Per-Quote

### calib-001

- expected: ["童年","记忆","音乐"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 童年(canonical:童年), 时间(canonical:时间)

### calib-002

- expected: ["智慧","语言"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 智慧(canonical:智慧), 表达(canonical:表达)

### calib-003

- expected: ["死亡","轮回"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 死亡(canonical:死亡), 轮回(canonical:轮回), 倦怠(canonical:倦怠), 厌恶(canonical:厌恶), 痛苦(alias:苦痛)

### calib-004

- expected: ["伦理"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 伦理(alias:道德)

### calib-005

- expected: ["时间"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 时间(canonical:时间)

### calib-006

- expected: ["时间","恐惧"]
- Recall@5/10/20: 0.5000 / 0.5000 / 0.5000
- deterministic hits: 时间(canonical:时间), 性(canonical:性)

### calib-007

- expected: ["死亡"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 死亡(canonical:死亡), 绝望(canonical:绝望), 秩序(canonical:秩序)

### calib-008

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: 孤独(canonical:孤独)

### calib-009

- expected: ["记忆","遗忘"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 破坏(canonical:破坏), 衰败(alias:衰退), 记忆(canonical:记忆), 性(canonical:性)

### calib-010

- expected: ["焦虑"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 焦虑(alias:不安), 焦虑(canonical:焦虑)

### calib-011

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: (none)

### calib-012

- expected: ["满足","占有"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 满足(canonical:满足), 占有(alias:掌控)

### calib-013

- expected: ["死亡"]
- Recall@5/10/20: 0.0000 / 1.0000 / 1.0000
- deterministic hits: 死亡(canonical:死亡), 身体(canonical:身体)

### calib-014

- expected: ["观察"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 时间(canonical:时间), 观察(canonical:观察)

### calib-015

- expected: ["废墟","末日"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 废墟(canonical:废墟), 城市(canonical:城市)

### calib-016

- expected: ["好奇"]
- Recall@5/10/20: 0.0000 / 1.0000 / 1.0000
- deterministic hits: 好奇(alias:好奇心), 好奇(canonical:好奇)

### calib-017

- expected: ["虚无"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 虚无(alias:空虚), 希望(canonical:希望)

### calib-018

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: 书籍(alias:阅读)

### calib-019

- expected: ["希望"]
- Recall@5/10/20: 0.0000 / 1.0000 / 1.0000
- deterministic hits: 过去(canonical:过去), 希望(canonical:希望)

### calib-020

- expected: ["爱情"]
- Recall@5/10/20: 0.0000 / 0.0000 / 1.0000
- deterministic hits: (none)

### calib-021

- expected: ["梦"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 梦(alias:梦境), 梦(canonical:梦), 寻找(canonical:寻找)

### calib-022

- expected: ["时间"]
- Recall@5/10/20: 0.0000 / 0.0000 / 0.0000
- deterministic hits: (none)

### calib-023

- expected: ["时间"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 过去(canonical:过去)

### calib-024

- expected: ["倦怠"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: (none)

### calib-025

- expected: ["财富"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 爱情(alias:爱)

### calib-026

- expected: ["恐惧"]
- Recall@5/10/20: 0.0000 / 0.0000 / 0.0000
- deterministic hits: 距离(canonical:距离), 爱情(alias:爱)

### calib-027

- expected: ["友情"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: (none)

### calib-028

- expected: ["死亡","名声"]
- Recall@5/10/20: 0.5000 / 1.0000 / 1.0000
- deterministic hits: 名声(alias:名誉), 名声(alias:荣誉)

### calib-029

- expected: ["命运"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 命运(canonical:命运), 适应(alias:接受)

