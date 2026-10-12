# Retrieval run `route-comparison-generate-map-20261012-cold`

- route: **generate-map**
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
| mean Recall@3 | 0.5970 |
| mean Recall@5 | 0.6609 |
| Success@3 (quotes with ≥1 expected Theme in Top 3) | 46/55 (0.8364) |

## Processing Time

| Metric | Value |
| --- | --- |
| mean per-quote tagging time (complete generate-map route) | 425.21 ms |
| one-time embedding/theme-index preparation | 8546.34 ms |
| one-time route-model preparation | 3675.15 ms |
| estimated 1,000-quote batch time | 437427.58 ms (7.29 min) |

Estimate: embedding/theme-index preparation + route-model preparation + mean per-quote time × 1000. This uses the runner's current sequential processing and excludes human review and external import/network delays.

## Per-Quote

### batch1-calib-001

- expected: ["童年","记忆","音乐"]
- Recall@3/5: 0.3333 / 0.6667
- tagging latency: 56.21 ms
- generated concepts: ["歌声","童年回忆","安静运河"]
- deterministic hits: 童年(canonical:童年), 时间(canonical:时间)

### batch1-calib-002

- expected: ["智慧","语言"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 321.20 ms
- generated concepts: ["知识","智慧"]
- deterministic hits: 智慧(canonical:智慧), 表达(canonical:表达)

### batch1-calib-003

- expected: ["死亡","轮回"]
- Recall@3/5: 0.5000 / 1.0000
- tagging latency: 421.31 ms
- generated concepts: ["轮回","厌恶","死亡","倦怠","苦痛"]
- deterministic hits: 死亡(canonical:死亡), 轮回(canonical:轮回), 倦怠(canonical:倦怠), 厌恶(canonical:厌恶), 痛苦(alias:苦痛)

### batch1-calib-004

- expected: ["伦理"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 461.02 ms
- generated concepts: ["道德","善与恶","仁慈与残忍","正派"]
- deterministic hits: 伦理(alias:道德)

### batch1-calib-005

- expected: ["时间"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 385.62 ms
- generated concepts: ["时间","物质","矿藏"]
- deterministic hits: 时间(canonical:时间)

### batch1-calib-006

- expected: ["时间","恐惧"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 504.69 ms
- generated concepts: ["人类对时间的敌意","野性的时间","世界时钟","星系的坍塌"]
- deterministic hits: 时间(canonical:时间), 性(canonical:性)

### batch1-calib-007

- expected: ["死亡"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 452.51 ms
- generated concepts: ["气味","味道","死亡","警告","绝望"]
- deterministic hits: 死亡(canonical:死亡), 绝望(canonical:绝望), 秩序(canonical:秩序)

### batch1-calib-008

- expected: []
- Recall@3/5: n/a / n/a
- tagging latency: 450.69 ms
- generated concepts: ["孤独","受惊","逃离","寂静","泥沼"]
- deterministic hits: 孤独(canonical:孤独)

### batch1-calib-009

- expected: ["记忆","遗忘"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 487.67 ms
- generated concepts: ["记忆力衰退","破坏性影响","位置放错","火柴","帕林卡酒盅"]
- deterministic hits: 破坏(canonical:破坏), 衰败(alias:衰退), 记忆(canonical:记忆), 性(canonical:性)

### batch1-calib-010

- expected: ["焦虑"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 414.75 ms
- generated concepts: ["深层不安","焦虑","冲动书写","自我否定"]
- deterministic hits: 焦虑(alias:不安), 焦虑(canonical:焦虑)

### batch1-calib-011

- expected: []
- Recall@3/5: n/a / n/a
- tagging latency: 358.12 ms
- generated concepts: ["钥匙","酸臭味","洗澡"]
- deterministic hits: (none)

### batch1-calib-012

- expected: ["满足","占有"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 348.83 ms
- generated concepts: ["掌控力","温暖","满足"]
- deterministic hits: 满足(canonical:满足), 占有(alias:掌控)

### batch1-calib-013

- expected: ["死亡"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 387.71 ms
- generated concepts: ["身体脏器","交易关系","死亡与腐烂"]
- deterministic hits: 死亡(canonical:死亡), 身体(canonical:身体)

### batch1-calib-014

- expected: ["观察"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 455.65 ms
- generated concepts: ["医生","日记本","草图","水坑","水流"]
- deterministic hits: 时间(canonical:时间), 观察(canonical:观察)

### batch1-calib-015

- expected: ["废墟","末日"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 596.37 ms
- generated concepts: ["衣衫褴褛的队伍","沙漠般的荒野","城市废墟","硝烟和火光","巨大虚斑"]
- deterministic hits: 废墟(canonical:废墟), 城市(canonical:城市)

### batch1-calib-016

- expected: ["好奇"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 387.44 ms
- generated concepts: ["好奇心","问候","寒暄"]
- deterministic hits: 好奇(alias:好奇心), 好奇(canonical:好奇)

### batch1-calib-017

- expected: ["虚无"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 392.66 ms
- generated concepts: ["空虚感","生活体验","情感断裂"]
- deterministic hits: 虚无(alias:空虚), 希望(canonical:希望), 生活(canonical:生活)

### batch1-calib-018

- expected: []
- Recall@3/5: n/a / n/a
- tagging latency: 460.09 ms
- generated concepts: ["刀刃","纸张","思想","文字","阅读"]
- deterministic hits: 文学(alias:阅读), 思考(alias:思想)

### batch1-calib-019

- expected: ["希望"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 381.78 ms
- generated concepts: ["希望","年代","心满意足","书店"]
- deterministic hits: 过去(canonical:过去), 希望(canonical:希望), 当下(alias:现在), 生活(canonical:生活)

### batch1-calib-020

- expected: ["爱情"]
- Recall@3/5: 0.0000 / 1.0000
- tagging latency: 358.07 ms
- generated concepts: ["女读者","磁场","吸引力"]
- deterministic hits: 幸福(canonical:幸福)

### batch1-calib-021

- expected: ["梦"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 365.59 ms
- generated concepts: ["梦境","绝对时空","循环"]
- deterministic hits: 梦(alias:梦境), 梦(canonical:梦), 寻找(canonical:寻找)

### batch1-calib-022

- expected: ["时间"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 426.48 ms
- generated concepts: ["时间倒流","断头台","死亡"]
- deterministic hits: (none)

### batch1-calib-023

- expected: ["时间"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 393.13 ms
- generated concepts: ["时间流逝","无法逆转的时间","过去"]
- deterministic hits: 过去(canonical:过去), 经历(canonical:经历)

### batch1-calib-024

- expected: ["倦怠"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 322.90 ms
- generated concepts: ["懒惰","借口"]
- deterministic hits: (none)

### batch1-calib-025

- expected: ["财富"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 502.66 ms
- generated concepts: ["下人的敬爱","邻人的友爱","富人保护财产的力量"]
- deterministic hits: 爱情(alias:爱)

### batch1-calib-026

- expected: ["恐惧"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 355.34 ms
- generated concepts: ["仆人","惧怕","敬爱"]
- deterministic hits: 距离(canonical:距离), 爱情(alias:爱)

### batch1-calib-027

- expected: ["友情"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 453.42 ms
- generated concepts: ["甜言蜜语","诱捕的罗网"]
- deterministic hits: (none)

### batch1-calib-028

- expected: ["死亡","名声"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 349.43 ms
- generated concepts: ["荣誉","名声","死亡"]
- deterministic hits: 名声(alias:名誉), 名声(alias:荣誉)

### batch1-calib-029

- expected: ["命运"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 396.36 ms
- generated concepts: ["自愿行动","接受命运","不可避免情形"]
- deterministic hits: 命运(canonical:命运), 接受(canonical:接受)

### batch2-batch2-001

- expected: ["文学"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 393.08 ms
- generated concepts: ["图书","书店","笼中狗"]
- deterministic hits: (none)

### batch2-batch2-002

- expected: ["时间","爱情","文学","思考"]
- Recall@3/5: 0.7500 / 0.7500
- tagging latency: 386.34 ms
- generated concepts: ["时间","小说","爱","思考"]
- deterministic hits: 时间(canonical:时间), 爱情(alias:爱), 思考(canonical:思考)

### batch2-batch2-003

- expected: ["目标","生活"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 408.68 ms
- generated concepts: ["时间","因果","不可逆性"]
- deterministic hits: 离开(canonical:离开), 生活(canonical:生活)

### batch2-batch2-004

- expected: ["科技"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 515.44 ms
- generated concepts: ["伪科学","天文学","占星术","化学","炼金术"]
- deterministic hits: 文学(canonical:文学)

### batch2-batch2-005

- expected: ["人性","科技"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 380.52 ms
- generated concepts: ["教条主义","学术僵化"]
- deterministic hits: (none)

### batch2-batch2-006

- expected: ["人性","选择","智慧"]
- Recall@3/5: 0.3333 / 0.6667
- tagging latency: 450.81 ms
- generated concepts: ["非凡能力","坚强个性","恒定频率","选择不均"]
- deterministic hits: 选择(canonical:选择), 性(canonical:性)

### batch2-batch2-007

- expected: ["命运","接受"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 566.71 ms
- generated concepts: ["尊敬的做法","硬着头皮往前走","陷入泥潭","不理解的东西","活活淹死"]
- deterministic hits: (none)

### batch2-batch2-008

- expected: ["自杀","痛苦"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 398.37 ms
- generated concepts: ["承受不幸","痛苦极致","自杀力量"]
- deterministic hits: 自杀(canonical:自杀), 痛苦(canonical:痛苦), 和平(alias:太平)

### batch2-batch2-009

- expected: ["幸福"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 419.36 ms
- generated concepts: ["不安宁的生活","幸福的瞬间","美好事物"]
- deterministic hits: 经历(alias:经验), 幸福(canonical:幸福), 平静(alias:安宁), 焦虑(alias:不安), 审美(alias:美), 美好(alias:美好事物), 美好(canonical:美好)

### batch2-batch2-010

- expected: ["幸福","爱情","复杂性"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 492.01 ms
- generated concepts: ["双重人格","爱人的代价","社会面具","人性复杂性"]
- deterministic hits: 爱情(alias:爱), 性(canonical:性)

### batch2-batch2-011

- expected: ["智慧","满足","学习","生活"]
- Recall@3/5: 0.7500 / 1.0000
- tagging latency: 369.12 ms
- generated concepts: ["聪明","学习","满意","生活"]
- deterministic hits: 生活(canonical:生活)

### batch2-batch2-012

- expected: ["孤独","痛苦"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 433.11 ms
- generated concepts: ["渴望温暖","折磨自己","孤独","独立"]
- deterministic hits: 欲望(alias:渴求), 孤独(canonical:孤独), 痛苦(alias:折磨)

### batch2-batch2-013

- expected: ["勇气","意志","恐惧","文学","善恶"]
- Recall@3/5: 0.2000 / 0.4000
- tagging latency: 441.46 ms
- generated concepts: ["地狱之旅","灵魂世界","意志","混沌","邪恶"]
- deterministic hits: 意志(canonical:意志), 旅行(canonical:旅行), 灵魂(canonical:灵魂)

### batch2-batch2-014

- expected: ["时间","死亡","生命","爱情","文学"]
- Recall@3/5: 0.2000 / 0.4000
- tagging latency: 485.25 ms
- generated concepts: ["爱的力量","永恒的信念","生命的终结","爱的延续","谎言"]
- deterministic hits: 死亡(canonical:死亡), 生命(canonical:生命), 爱情(alias:爱), 谎言(canonical:谎言), 信仰(alias:信念)

### batch2-batch2-015

- expected: ["文学","灵魂","身体","复杂性"]
- Recall@3/5: 0.2500 / 0.2500
- tagging latency: 533.37 ms
- generated concepts: ["浮士德","两个灵魂","荒原狼","梅菲斯特","灵魂"]
- deterministic hits: 灵魂(canonical:灵魂)

### batch2-batch2-016

- expected: ["经历","幸福","生活"]
- Recall@3/5: 0.6667 / 0.6667
- tagging latency: 506.41 ms
- generated concepts: ["快乐","狂喜","巅峰体验","现实生活","荒诞"]
- deterministic hits: 经历(canonical:经历), 幸福(alias:快乐), 爱情(alias:爱), 艺术(alias:文艺), 生活(canonical:生活)

### batch2-batch2-017

- expected: ["童年","幸福","痛苦","复杂性"]
- Recall@3/5: 0.7500 / 0.7500
- tagging latency: 414.77 ms
- generated concepts: ["孩子","幸福","矛盾","分裂","痛苦"]
- deterministic hits: 童年(alias:孩子), 幸福(canonical:幸福), 痛苦(canonical:痛苦)

### batch2-batch2-018

- expected: ["幸福","痛苦","幽默"]
- Recall@3/5: 0.3333 / 0.3333
- tagging latency: 439.36 ms
- generated concepts: ["幽默","伟大使命","悲剧人物","非凡人物"]
- deterministic hits: 审美(alias:美), 幽默(canonical:幽默)

### batch2-batch2-019

- expected: ["人性","痛苦","目标","复杂性"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 556.39 ms
- generated concepts: ["理想","自保","神圣性","绝对性","侍奉上帝"]
- deterministic hits: 性(canonical:性), 牺牲(alias:献身), 目标(alias:追求)

### batch2-batch2-020

- expected: ["时间","观察","当下"]
- Recall@3/5: 0.3333 / 0.3333
- tagging latency: 402.47 ms
- generated concepts: ["真实行动","真正情感","永恒","当下"]
- deterministic hits: 真相(alias:真实), 当下(canonical:当下)

### batch2-batch2-021

- expected: ["人性","死亡","目标","生活","美好"]
- Recall@3/5: 0.2000 / 0.4000
- tagging latency: 373.26 ms
- generated concepts: ["战斗","理想","死亡","生命"]
- deterministic hits: 死亡(canonical:死亡), 生命(canonical:生命), 爱情(alias:爱), 审美(alias:美), 美好(alias:美好事物), 美好(canonical:美好)

### batch2-batch2-022

- expected: ["父亲","满足","亲情","表达","疏离"]
- Recall@3/5: 0.4000 / 0.4000
- tagging latency: 389.15 ms
- generated concepts: ["父子关系","沉默的陪伴","家庭氛围"]
- deterministic hits: 父亲(alias:父), 父亲(canonical:父亲), 满足(canonical:满足)

### batch2-batch2-023

- expected: ["时间","死亡","生命","自我身份","目标","生活"]
- Recall@3/5: 0.3333 / 0.5000
- tagging latency: 424.14 ms
- generated concepts: ["生命终结","自我塑造","永恒探索"]
- deterministic hits: 生命(canonical:生命), 自我身份(alias:自我)

### batch2-batch2-024

- expected: ["厌恶","音乐","科技"]
- Recall@3/5: 0.3333 / 0.6667
- tagging latency: 544.41 ms
- generated concepts: ["金属漏斗","橡胶","支气管黏液","留声机","收音机"]
- deterministic hits: 音乐(canonical:音乐)

### batch2-batch2-025

- expected: ["幸福","爱情"]
- Recall@3/5: 0.5000 / 0.5000
- tagging latency: 574.90 ms
- generated concepts: ["涂红的嘴唇","毫无血色的脸","僵硬","一生","幸福"]
- deterministic hits: 幸福(canonical:幸福), 爱情(alias:爱), 爱情(canonical:爱情)

### batch2-batch2-026

- expected: ["责任","罪","宗教"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 454.41 ms
- generated concepts: ["亚当","偷食禁果","赎罪"]
- deterministic hits: 责任(alias:负责), 救赎(alias:赎罪), 罪(canonical:罪)

### batch2-batch2-027

- expected: ["死亡","记忆","遗忘","孤独","爱情","病态"]
- Recall@3/5: 0.1667 / 0.1667
- tagging latency: 431.04 ms
- generated concepts: ["遗忘","保存","阴曹地府"]
- deterministic hits: 遗忘(canonical:遗忘), 牺牲(alias:献身), 当下(alias:现在)

### batch2-batch2-028

- expected: ["混乱","秩序"]
- Recall@3/5: 1.0000 / 1.0000
- tagging latency: 411.80 ms
- generated concepts: ["笑声","灰色水泥","气泡","混乱无序"]
- deterministic hits: 混乱(alias:无序), 混乱(canonical:混乱), 秩序(alias:规矩)

### batch2-batch2-029

- expected: ["失去"]
- Recall@3/5: 0.0000 / 0.0000
- tagging latency: 418.12 ms
- generated concepts: ["心碎","情感疏离","痛苦"]
- deterministic hits: 失去(canonical:失去), 身体(canonical:身体)

