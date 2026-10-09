# Retrieval run `calib-qwen06b-B`

- representation: **B**
- provider: `qwen3-embedding` / Qwen/Qwen3-Embedding-0.6B
- git: `5f36a0244671f627f5d35b9b1b0a9c842331d91a`
- tag library: atomic-tag-library.v1.41 (`d8e8d97127d5…`)
- benchmark: calib-zh-themes.v1 (`9ff6a089238a…`)

## Aggregate Recall

| Metric | Value |
| --- | --- |
| evaluated quotes | 21 |
| skipped (empty expected) | 8 |
| mean Recall@5 | 0.6032 |
| mean Recall@10 | 0.8095 |
| mean Recall@20 | 0.9048 |

## Per-Quote

### calib-001

- expected: ["童年","记忆","音乐"]
- Recall@5/10/20: 0.6667 / 1.0000 / 1.0000
- deterministic hits: 童年(canonical:童年), 寂静(alias:安静)

### calib-002

- expected: ["智慧","语言"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 智慧(canonical:智慧), 表达(canonical:表达)

### calib-003

- expected: ["死亡","轮回"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 水(canonical:水), 死亡(canonical:死亡), 轮回(canonical:轮回), 倦怠(canonical:倦怠), 厌恶(canonical:厌恶), 痛苦(alias:苦痛)

### calib-004

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: (none)

### calib-005

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: (none)

### calib-006

- expected: ["恐惧"]
- Recall@5/10/20: 0.0000 / 0.0000 / 0.0000
- deterministic hits: 空间(canonical:空间), 性(canonical:性)

### calib-007

- expected: ["死亡"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 死亡(canonical:死亡), 绝望(canonical:绝望), 气味(canonical:气味), 秩序(canonical:秩序)

### calib-008

- expected: ["寂静"]
- Recall@5/10/20: 0.0000 / 0.0000 / 1.0000
- deterministic hits: 动物(canonical:动物), 土地(alias:大地), 天空(canonical:天空), 孤独(canonical:孤独), 寂静(canonical:寂静)

### calib-009

- expected: ["记忆","遗忘"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 火(canonical:火), 破坏(canonical:破坏), 衰败(alias:衰退), 记忆(canonical:记忆), 性(canonical:性)

### calib-010

- expected: ["焦虑"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 焦虑(alias:不安), 焦虑(canonical:焦虑)

### calib-011

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: 气味(canonical:气味)

### calib-012

- expected: ["满足","掌控"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 满足(canonical:满足), 黑暗(alias:暗), 掌控(canonical:掌控)

### calib-013

- expected: ["死亡"]
- Recall@5/10/20: 0.0000 / 0.0000 / 1.0000
- deterministic hits: 死亡(canonical:死亡), 身体(canonical:身体)

### calib-014

- expected: ["观察"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 水(canonical:水), 神(canonical:神), 观察(canonical:观察)

### calib-015

- expected: ["废墟","末日"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 废墟(canonical:废墟), 火(canonical:火), 光(canonical:光), 城市(canonical:城市)

### calib-016

- expected: ["好奇"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
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

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: (none)

### calib-021

- expected: ["梦"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 梦(alias:梦境), 梦(canonical:梦), 寻找(canonical:寻找)

### calib-022

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: (none)

### calib-023

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: 过去(canonical:过去)

### calib-024

- expected: []
- Recall@5/10/20: n/a / n/a / n/a
- deterministic hits: (none)

### calib-025

- expected: ["财富"]
- Recall@5/10/20: 1.0000 / 1.0000 / 1.0000
- deterministic hits: 爱(canonical:爱), 自我(alias:自身)

### calib-026

- expected: ["恐惧"]
- Recall@5/10/20: 0.0000 / 0.0000 / 0.0000
- deterministic hits: 距离(canonical:距离), 爱(canonical:爱)

### calib-027

- expected: ["友情"]
- Recall@5/10/20: 0.0000 / 1.0000 / 1.0000
- deterministic hits: (none)

### calib-028

- expected: ["死亡"]
- Recall@5/10/20: 0.0000 / 1.0000 / 1.0000
- deterministic hits: 名声(alias:名誉)

### calib-029

- expected: ["命运"]
- Recall@5/10/20: 0.0000 / 1.0000 / 1.0000
- deterministic hits: 命运(canonical:命运), 接受(canonical:接受)

