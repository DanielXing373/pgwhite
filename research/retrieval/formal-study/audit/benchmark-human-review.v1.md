# Benchmark Human Review — 58 quotes

**Review complete.** Authoritative decisions are in `benchmark-human-review.v1.tsv` and `benchmark/formal-benchmark.v1.frozen.json`. The per-quote sections below are the pre-review worksheet and still say PENDING; do not use them as ground truth.

- Git SHA: `3b6c9547178aa91b2ef3b5612ae87bfc31e64416`
- Ontology: `atomic-tag-library.v1.43` sha256=`a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7` (185 active Themes)
- Combined source: `research/retrieval/benchmark/fixtures/route-comparison-development.json`
- Audit counts: {'CLEAR': 22, 'AMBIGUOUS': 24, 'ZERO-THEME': 3, 'QUESTIONABLE': 9}

## How to review
1. Open `benchmark-human-review.v1.tsv` in a spreadsheet **or** this Markdown.
2. For each row, set `human_review_status` to `APPROVED` or `EDITED`.
3. If EDITED: fill `proposed_expected_theme_labels` (canonical ZH from frozen ontology only; empty = zero-theme).
4. Do **not** invent new Themes. Do **not** edit original fixtures under `benchmark/fixtures/`.
5. When all 58 are reviewed, we will build `benchmark/formal-benchmark.v1.frozen.json` and freeze hashes.

## ZERO-THEME policy
Empty expected Themes means the quote should not be required to receive a Theme under the frozen ontology. Selector may return []. Retrieval still ranks Themes (false suggestions are separately scored).

## QUESTIONABLE (9)

### batch1-calib-014 [batch1]
- expected: ['观察']
- audit_reason: 观察偏动作描写（医生记水坑），作为文学Theme偏弱，近乎场景记录而非可复用主题。
- definitions:
  - **观察** (`theme-0198-观察`): 注视、打量与认知他者/世界。
- quote: 医生全神贯注地观察了一会儿，然后在日记本里勾画了一张场景的草图，就连最小的水坑、水流都仔细、认真地标记出来，随后在草图的下方注明了时间。
- human_review_status: `PENDING`

### batch1-calib-016 [batch1]
- expected: ['好奇']
- audit_reason: 好奇指他人令人作呕的好奇心，主题落点模糊；笔记亦称难分类，虚伪为替代解释。
- definitions:
  - **好奇** (`theme-0088-好奇`): 想知道、探索与追问的驱力。
- quote: 那样一来，他就不得不应付那些伪装成狡黠、粗俗的问候和寒暄的令人作呕的好奇心。
- human_review_status: `PENDING`

### batch1-calib-020 [batch1]
- expected: ['爱情']
- audit_reason: 爱情依赖“磁场/女读者”的浪漫投射解读，原文更像阅读注意机制，爱情证据偏弱。
- definitions:
  - **爱情** (`theme-0123-爱情`): 人与人之间的爱与亲密情感，包括浪漫吸引、依恋和情感纠葛。
- quote: 读者啊！那位幸福的女读者进入你的视野，进入你注意的范围，或者说你陷入了一个磁场，而且摆脱不了这个磁场的吸引力。
- human_review_status: `PENDING`

### batch2-batch2-001 [batch2]
- expected: ['文学']
- audit_reason: 文学仅因书店/图书场景；段落重心是物的拟人凝视与离开，疏离/孤独可能更贴。
- definitions:
  - **文学** (`theme-0137-文学`): 文学作品及其阅读、书写与审美或思想经验。
- quote: 你茫然地向周围的图书又看了一眼，便走出书店(或者说得更确切些，周围的图书怏怏地望着你走开，仿佛一只只丢失后被收容在市政府特意设置的笼子里的狗，看见一个同伴被其主人认领后牵着链子救走了)。
- human_review_status: `PENDING`

### batch2-batch2-004 [batch2]
- expected: ['科技']
- audit_reason: 科技定义偏技术应用，原文谈科学与伪科学配对，更像知识/科学（库中无“科学”）。
- definitions:
  - **科技** (`theme-0160-科技`): 科学知识及其实际应用形成的方法、工具与技术变化。
- quote: 每一门科学都有其相应的伪科学，由某种特殊类型的头脑所产生的怪诞扭曲形式，天文学有占星术这一滑稽模仿的伴侣，而化学则曾经有过炼金术。
- human_review_status: `PENDING`

### batch2-batch2-005 [batch2]
- expected: ['人性', '科技']
- audit_reason: 研究穷尽→教条，与人性/科技定义契合弱，偏抽象议论标签。
- definitions:
  - **人性** (`theme-0029-人性`): 关于人固有倾向、善恶与限度的思索。
  - **科技** (`theme-0160-科技`): 科学知识及其实际应用形成的方法、工具与技术变化。
- quote: 当所有可研究的东西都被研究完了的时候，教条主义和学术僵化就会接踵而至。
- human_review_status: `PENDING`

### batch2-batch2-006 [batch2]
- expected: ['人性', '选择', '智慧']
- audit_reason: 天才降生频率与选择，人性/智慧证据弱，选择字面有但主题稀薄。
- definitions:
  - **人性** (`theme-0029-人性`): 关于人固有倾向、善恶与限度的思索。
  - **选择** (`theme-0060-选择`): 在可能性之间做出取舍及其后果。
  - **智慧** (`theme-0070-智慧`): 深刻洞见与妥善判断的智性品质。
- quote: 能力非凡且个性坚强的人降生的频率多少是恒定的，只是他们的选择不均匀。
- human_review_status: `PENDING`

### batch2-batch2-017 [batch2]
- expected: ['童年', '幸福', '痛苦', '复杂性']
- audit_reason: 幸福被明确否定（“绝不是幸福的”）却列入期望，易造成假阴性/假阳性争议；痛苦/童年较稳。
- definitions:
  - **童年** (`theme-0010-童年`): 儿童时期的经验、感知与回忆。
  - **幸福** (`theme-0087-幸福`): 感到愉悦、满足或安好；包括具体的快乐时刻和对生活状态的幸福感。
  - **痛苦** (`theme-0105-痛苦`): 身体或精神上的受苦、伤痛与难耐体验。
  - **复杂性** (`theme-0224-复杂性`): 由多个相互作用的层面或因素构成，因而难以简单理解的性质。
- quote: 孩子们也绝不是幸福的，他们也有种种矛盾、种种分裂，承受着种种痛苦。
- human_review_status: `PENDING`

### batch2-batch2-019 [batch2]
- expected: ['人性', '痛苦', '目标', '复杂性']
- audit_reason: 人性尚可；痛苦/目标证据弱；复杂性偏填充标签。
- definitions:
  - **人性** (`theme-0029-人性`): 关于人固有倾向、善恶与限度的思索。
  - **痛苦** (`theme-0105-痛苦`): 身体或精神上的受苦、伤痛与难耐体验。
  - **目标** (`theme-0223-目标`): 行动、选择或愿望所指向的目的、追求与预期成果。
  - **复杂性** (`theme-0224-复杂性`): 由多个相互作用的层面或因素构成，因而难以简单理解的性质。
- quote: 他们的理想不是献身，而是自保。他们所追求的既不是神圣性，亦不是神圣性的对立面。一切绝对性他们都难以承受。他们虽侍奉上帝，却也贪图享乐，虽志愿品行端正，却也要在尘世中享有轻松舒适。
- human_review_status: `PENDING`

## AMBIGUOUS (24)

### batch1-calib-002 [batch1]
- expected: ['智慧', '语言']
- audit_reason: 智慧清楚；语言指向“无法用言语表达”，是元评论而非主题重心；知识为库外概念（已记 taxonomy_gap）。
- definitions:
  - **智慧** (`theme-0070-智慧`): 深刻洞见与妥善判断的智性品质。
  - **语言** (`theme-0145-语言`): 言说、命名与表达能否抵达的问题。
- quote: 知识是可以传授的，而智慧却不能。智慧只能被发现、被体验，可以活出来，可以成为人心的依托，甚至可以借它创造奇迹，但它无法用言语表达，也无法教授他人。
- human_review_status: `PENDING`

### batch1-calib-004 [batch1]
- expected: ['伦理']
- audit_reason: 伦理清楚对应道德计量难题；善恶在原文点名，是否也应作为必选取决于标注哲学。
- definitions:
  - **伦理** (`theme-0219-伦理`): 关于行为正当性、责任、义务与价值规范的思考。
- quote: 道德没有计量单位，即便对于那些永恒而普遍的范畴（诸如善与恶，仁慈与残忍），我们也时常稀里糊涂、无从对照，分不清谁是真正的善良，谁只是没有坏心眼儿；不知道何谓真正的正派，也搞不清楚这些品质的标准究竟何在。
- human_review_status: `PENDING`

### batch1-calib-006 [batch1]
- expected: ['时间', '恐惧']
- audit_reason: 时间清楚；恐惧来自“更加可怕”，属时间拟人化修辞，是否构成独立恐惧主题可争。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
  - **恐惧** (`theme-0097-恐惧`): 对危险、未知或伤害的害怕与惊惧。
- quote: 人类对时间总抱有敌意。空间、物质，这些东西都被人驯服了。唯独时间，亘古便野性难驯。自人类眺望宇宙深处以来，便听得到世界时钟数十亿年未曾中断的嘀嗒声；当人类目睹星系的坍塌时，时间似乎变得更加可怕了。
- human_review_status: `PENDING`

### batch1-calib-019 [batch1]
- expected: ['希望']
- audit_reason: 希望清楚；满足/绝望边界笔记已提示可能并存。
- definitions:
  - **希望** (`theme-0093-希望`): 对更好可能的期待与信心。
- quote: 你原来认为对生活寄托希望的年代已经过去了，现在却心满意足地走出书店。
- human_review_status: `PENDING`

### batch1-calib-022 [batch1]
- expected: ['时间']
- audit_reason: 时间/日历倒退清楚；断头台死亡意象被当作比喻——死亡是否应入选取决于是否字面化。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
- quote: 难道你就没有想到我手表上的日历在那个小方框里啪啪倒退，仿佛断头台上被屠刀砍下的头颅一个个从我脚下滚过吗？
- human_review_status: `PENDING`

### batch1-calib-024 [batch1]
- expected: ['倦怠']
- audit_reason: 懒惰谚语映射到拓宽后的倦怠；是否接受“懒惰⊂倦怠”取决于定义哲学。
- definitions:
  - **倦怠** (`theme-0081-倦怠`): 身心疲乏、懈怠或缺乏行动意愿，也包括长期消耗后的提不起劲。
- quote: 懒汉不干活，冬天里借口天冷，夏天里借口天热。
- human_review_status: `PENDING`

### batch1-calib-026 [batch1]
- expected: ['恐惧']
- audit_reason: 惧怕vs敬爱；敬畏可能更贴切（笔记已提边界主观）。
- definitions:
  - **恐惧** (`theme-0097-恐惧`): 对危险、未知或伤害的害怕与惊惧。
- quote: 凡是你仆人和对你毕恭毕敬的人，对他们的意见特别要保持距离；因为他们的话恐怕出于惧怕而非敬爱。
- human_review_status: `PENDING`

### batch1-calib-027 [batch1]
- expected: ['友情']
- audit_reason: 友情字面出现，但句意是虚伪诱捕；虚伪/欺骗可能更核心。
- definitions:
  - **友情** (`theme-0117-友情`): 非血缘、非情爱的友伴关系与互助信任。
- quote: 对朋友甜言蜜语的人，在他脚前安置了诱捕的罗网。
- human_review_status: `PENDING`

### batch2-batch2-002 [batch2]
- expected: ['时间', '爱情', '文学', '思考']
- audit_reason: 时间/思考清楚；爱情来自“爱”字；文学来自写长篇——多标签是否全为必选可争。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
  - **爱情** (`theme-0123-爱情`): 人与人之间的爱与亲密情感，包括浪漫吸引、依恋和情感纠葛。
  - **文学** (`theme-0137-文学`): 文学作品及其阅读、书写与审美或思想经验。
  - **思考** (`theme-0230-思考`): 围绕事物形成想法、理解或判断的心智活动。
- quote: 今天写长篇小说也许是自相矛盾，时间的维度被打碎了，我们只能在时间的碎片中爱和思考，每一个时间的碎片沿着自己的轨迹运行，在瞬间消失。
- human_review_status: `PENDING`

### batch2-batch2-003 [batch2]
- expected: ['目标', '生活']
- audit_reason: 生活尚可；目标偏弱（回复零位置更像时间/命运/失控）。
- definitions:
  - **目标** (`theme-0223-目标`): 行动、选择或愿望所指向的目的、追求与预期成果。
  - **生活** (`theme-0229-生活`): 个人生活的现实处境、日常活动、关系与人生历程；区别于生物意义上的生命。
- quote: 但是我生活中的每个时刻都是由一些新的事件组成的，而每个新的事件又必然带来新的后果，因此我愈想回复到最初的“零”位置，反而离开这个位置愈远。
- human_review_status: `PENDING`

### batch2-batch2-007 [batch2]
- expected: ['命运', '接受']
- audit_reason: 硬着头皮走入不可理解之泥潭，可作命运/接受，亦可作绝望/虚无。
- definitions:
  - **命运** (`theme-0032-命运`): 命运、宿命或更大力量如何牵引人生轨迹，也包括人对这种不可控性的感受。
  - **接受** (`theme-0059-接受`): 承认并接纳难以改变的事实或处境，减少抗拒并继续应对。
- quote: 仿佛值得尊敬的做法就是硬着头皮往前走，陷入一片泥潭，在你不理解而且永远都不会理解的东西里活活淹死。
- human_review_status: `PENDING`

### batch2-batch2-010 [batch2]
- expected: ['幸福', '爱情', '复杂性']
- audit_reason: 爱情清楚；幸福存疑（令别人不幸）；复杂性偏抽象填充。
- definitions:
  - **幸福** (`theme-0087-幸福`): 感到愉悦、满足或安好；包括具体的快乐时刻和对生活状态的幸福感。
  - **爱情** (`theme-0123-爱情`): 人与人之间的爱与亲密情感，包括浪漫吸引、依恋和情感纠葛。
  - **复杂性** (`theme-0224-复杂性`): 由多个相互作用的层面或因素构成，因而难以简单理解的性质。
- quote: 他爱人或被爱时，也令别人不幸。因为所有爱他的人，总是只看到他的一面。有些人爱他，视他为正派、聪明而优雅的人，一旦发现他身上的狼性，就既吃惊又失望。
- human_review_status: `PENDING`

### batch2-batch2-011 [batch2]
- expected: ['智慧', '满足', '学习', '生活']
- audit_reason: 满足/学习较稳；智慧由“聪明”推出偏强；生活宽泛。
- definitions:
  - **智慧** (`theme-0070-智慧`): 深刻洞见与妥善判断的智性品质。
  - **满足** (`theme-0103-满足`): 感到足够、安稳或心意落地的状态。
  - **学习** (`theme-0225-学习`): 通过学习、实践或经验获得知识、技能与理解的过程。
  - **生活** (`theme-0229-生活`): 个人生活的现实处境、日常活动、关系与人生历程；区别于生物意义上的生命。
- quote: 智力好的人能学会的东西，他学了不少，是个相当聪明的人。但他学不会的，却是对自己和生活感到满意。
- human_review_status: `PENDING`

### batch2-batch2-013 [batch2]
- expected: ['勇气', '意志', '恐惧', '文学', '善恶']
- audit_reason: 勇气/意志/恐惧有文本支持；文学/善恶是否必选取决于是否把“文字/邪恶”升格为主题，标签偏多。
- definitions:
  - **勇气** (`theme-0024-勇气`): 面对恐惧或压力仍坚持行动。
  - **意志** (`theme-0069-意志`): 坚持意向、推动行动的内在力量。
  - **恐惧** (`theme-0097-恐惧`): 对危险、未知或伤害的害怕与惊惧。
  - **文学** (`theme-0137-文学`): 文学作品及其阅读、书写与审美或思想经验。
  - **善恶** (`theme-0208-善恶`): 道德上的善与恶及其边界。
- quote: 全部的文字意味着一次地狱之旅，一次时而忧惧时而英勇的旅行，在幽暗的灵魂世界的混沌中，以意志穿越地狱，直面混沌，忍受邪恶，直至终点。
- human_review_status: `PENDING`

### batch2-batch2-014 [batch2]
- expected: ['时间', '死亡', '生命', '爱情', '文学']
- audit_reason: 死亡/生命/爱情清楚；时间因“永恒”偏弱；文学因恋人和诗人提及。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
  - **生命** (`theme-0045-生命`): 活着本身、生命力与生存境况。
  - **爱情** (`theme-0123-爱情`): 人与人之间的爱与亲密情感，包括浪漫吸引、依恋和情感纠葛。
  - **文学** (`theme-0137-文学`): 文学作品及其阅读、书写与审美或思想经验。
- quote: 恋人和诗人对爱的力量怀有永恒的信念，认为它比死亡还要持久，但那句千百年来一直缠着我们不放的“生命虽尽，爱犹未尽”，实际上不过是一句谎言。这句谎言只是徒劳无益，并非荒唐可笑。
- human_review_status: `PENDING`

### batch2-batch2-015 [batch2]
- expected: ['文学', '灵魂', '身体', '复杂性']
- audit_reason: 灵魂/复杂性有文本；文学靠浮士德互文；身体因胸膛/身躯偏字面。
- definitions:
  - **文学** (`theme-0137-文学`): 文学作品及其阅读、书写与审美或思想经验。
  - **灵魂** (`theme-0204-灵魂`): 内在精神本质或超越肉身的自我想象。
  - **身体** (`theme-0206-身体`): 肉身感知、外貌与身体处境。
  - **复杂性** (`theme-0224-复杂性`): 由多个相互作用的层面或因素构成，因而难以简单理解的性质。
- quote: 浮士德曾说过一句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其他灵魂。我们的荒原狼也认为他胸中住着两个灵魂（狼和人），还认为他的胸膛因此拥挤不堪。一个人的胸膛、身躯向来只有一个，但居住其中的，却绝不止两个或五个灵魂，而是无数个灵魂。
- human_review_status: `PENDING`

### batch2-batch2-018 [batch2]
- expected: ['幸福', '痛苦', '幽默']
- audit_reason: 幽默清楚；幸福弱；痛苦由不幸人物推出。
- definitions:
  - **幸福** (`theme-0087-幸福`): 感到愉悦、满足或安好；包括具体的快乐时刻和对生活状态的幸福感。
  - **痛苦** (`theme-0105-痛苦`): 身体或精神上的受苦、伤痛与难耐体验。
  - **幽默** (`theme-0226-幽默`): 对可笑、荒诞或反差的感受、表达与观察。
- quote: 幽默是那些在完成伟大使命的过程中重重受阻，那些接近成为悲剧人物、不幸的非凡人物的美妙发明。
- human_review_status: `PENDING`

### batch2-batch2-020 [batch2]
- expected: ['时间', '观察', '当下']
- audit_reason: 当下/时间（永恒）较稳；观察因“无人看见”偏弱或反向。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
  - **观察** (`theme-0198-观察`): 注视、打量与认知他者/世界。
  - **当下** (`theme-0227-当下`): 正在发生的现在，以及对即时现实或此刻经验的关注。
- quote: 但是，每个真实行动的画面、真正情感的力量，即便无人知晓，无人看见，无人为后人记录保存下来，也隶属永恒。在永恒中，没有后世，唯有当下。
- human_review_status: `PENDING`

### batch2-batch2-021 [batch2]
- expected: ['人性', '死亡', '目标', '生活', '美好']
- audit_reason: 死亡/美好/生活有支持；目标/人性是否必选可争，标签偏多。
- definitions:
  - **人性** (`theme-0029-人性`): 关于人固有倾向、善恶与限度的思索。
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
  - **目标** (`theme-0223-目标`): 行动、选择或愿望所指向的目的、追求与预期成果。
  - **生活** (`theme-0229-生活`): 个人生活的现实处境、日常活动、关系与人生历程；区别于生物意义上的生命。
  - **美好** (`theme-0231-美好`): 被认为值得珍视、向往或赞赏的事物与状态；不只指外在美感。
- quote: 如果你为了美好事物和理想战斗，并认为你一定会成功，那倒要平庸得多。难道理想都能实现？我们人活着，难道是为战胜死亡？不，我们活着，是为畏惧死亡，再爱上它。正因为它，微弱的生命才绽放短暂的光芒。
- human_review_status: `PENDING`

### batch2-batch2-022 [batch2]
- expected: ['父亲', '满足', '亲情', '表达', '疏离']
- audit_reason: 父亲/亲情/满足清楚；表达与疏离可疑——文本强调沉默却满足的陪伴，疏离可能相反。
- definitions:
  - **父亲** (`theme-0023-父亲`): 父职、父亲形象及其情感/权力关系（高复用关系概念）。
  - **满足** (`theme-0103-满足`): 感到足够、安稳或心意落地的状态。
  - **亲情** (`theme-0112-亲情`): 家庭成员之间的情感联结、关怀与牵挂。
  - **表达** (`theme-0144-表达`): 情感或思想如何被说出、写出或演出。
  - **疏离** (`theme-0191-疏离`): 与他人、社会或自我格格不入。
- quote: 因此父亲和欧维从来没有过多的交谈，但他们喜欢彼此的陪伴。沉默地分别坐在餐桌的两端就很满足。
- human_review_status: `PENDING`

### batch2-batch2-023 [batch2]
- expected: ['时间', '死亡', '生命', '自我身份', '目标', '生活']
- audit_reason: 死亡/生命/自我身份清楚；时间弱；目标/生活宽泛，六标签过密。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
  - **生命** (`theme-0045-生命`): 活着本身、生命力与生存境况。
  - **自我身份** (`theme-0221-自我身份`): 关于自我认同、身份形成及其变化的经验与思考。
  - **目标** (`theme-0223-目标`): 行动、选择或愿望所指向的目的、追求与预期成果。
  - **生活** (`theme-0229-生活`): 个人生活的现实处境、日常活动、关系与人生历程；区别于生物意义上的生命。
- quote: 如果生命终将结束于坟墓中，我们又为何致力于艰辛地塑造自我，探索永恒？
- human_review_status: `PENDING`

### batch2-batch2-024 [batch2]
- expected: ['厌恶', '音乐', '科技']
- audit_reason: 厌恶与（被贬低的）音乐清楚；科技指留声机/收音机，边界可接受但非必然。
- definitions:
  - **厌恶** (`theme-0086-厌恶`): 反感、嫌恶与排斥的情感反应。
  - **音乐** (`theme-0146-音乐`): 音乐作为情感、记忆与意义的载体。
  - **科技** (`theme-0160-科技`): 科学知识及其实际应用形成的方法、工具与技术变化。
- quote: 这邪恶的金属漏斗果然喷出嚼烂的橡胶和支气管黏液的混合物，喷出留声机的拥有者和收音机用户们齐声称为“音乐”的东西
- human_review_status: `PENDING`

### batch2-batch2-025 [batch2]
- expected: ['幸福', '爱情']
- audit_reason: 已有benchmark_ambiguity；幸福/爱情以反讽死亡面容呈现；绝望/痛苦为待确认候选。
- definitions:
  - **幸福** (`theme-0087-幸福`): 感到愉悦、满足或安好；包括具体的快乐时刻和对生活状态的幸福感。
  - **爱情** (`theme-0123-爱情`): 人与人之间的爱与亲密情感，包括浪漫吸引、依恋和情感纠葛。
- quote: 涂红的嘴唇在毫无血色的脸上越来越红。这副僵硬的嘴唇就像我的一生，像我可怜的幸福和爱情：一点红，画在一张死人的脸上。
- human_review_status: `PENDING`

### batch2-batch2-027 [batch2]
- expected: ['死亡', '记忆', '遗忘', '孤独', '爱情', '病态']
- audit_reason: 遗忘/记忆/爱情有线索；死亡靠阴曹地府隐喻；孤独/病态及六标签密度需审。
- definitions:
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
  - **记忆** (`theme-0077-记忆`): 记住、回想与被过去经验塑造的心智领地，可涵盖回忆唤起、保存与改变。
  - **遗忘** (`theme-0078-遗忘`): 记不起、被抹去或主动放下过去。
  - **孤独** (`theme-0090-孤独`): 缺乏联结、被隔绝或无人理解的感受。
  - **爱情** (`theme-0123-爱情`): 人与人之间的爱与亲密情感，包括浪漫吸引、依恋和情感纠葛。
  - **病态** (`theme-0228-病态`): 被描写为不健康、失常或难以自控的心理倾向、行为或关系状态。
- quote: 我几乎错过了她们每一个人，跌跌撞撞，逃之夭夭，随后将她们遗忘——但在这里，她们被保存下来，一个不缺，数以百计。现在我看见她们，献身于她们，沉沦于她们玫瑰色的昏暗的阴曹地府。
- human_review_status: `PENDING`

## ZERO-THEME (3)

### batch1-calib-008 [batch1]
- expected: ∅
- audit_reason: 当前标为零主题（感知类已删）。但孤独/恐惧/自然仍可能被主张——零主题政策需人工确认。
- quote: 没有一只鸟在固体般坚实的天空中飞翔，没有动物用窸窣的响动打破像晨雾般在大地上弥漫的寂静，只有一头孤独、受惊的小鹿——仿佛泥沼在呼吸——时而仰头，时而低头，时刻准备着逃离，逃向远方。
- human_review_status: `PENDING`

### batch1-calib-011 [batch1]
- expected: ∅
- audit_reason: 气味/探访场景；厌恶或身体可能被主张，但原文标注为无。
- quote: 克拉奈尔夫人单有一把进屋的钥匙，每次她来，刚一迈腿进屋，就立即能闻到刺鼻的酸臭味，这股气味被吸进她的衣服里，甚至渗透进她的皮肤里，即便她——"在登门探望医生的日子里"——每天洗两遍澡也无济于事。
- human_review_status: `PENDING`

### batch1-calib-018 [batch1]
- expected: ∅
- audit_reason: 阅读隐喻；文学Theme可被主张，但原标注为无——需确认零主题政策。
- quote: 你用刀刃在纸张中开路犹如用思想在文字中开路，因为阅读就像在密林中前进。
- human_review_status: `PENDING`

## CLEAR (22)

### batch1-calib-001 [batch1]
- expected: ['童年', '记忆', '音乐']
- audit_reason: 童年/记忆/音乐均由原文直接支持（唱歌、记得歌词、回到童年）。
- definitions:
  - **童年** (`theme-0010-童年`): 儿童时期的经验、感知与回忆。
  - **记忆** (`theme-0077-记忆`): 记住、回想与被过去经验塑造的心智领地，可涵盖回忆唤起、保存与改变。
  - **音乐** (`theme-0146-音乐`): 音乐作为情感、记忆与意义的载体。
- quote: 加德纳先生唱了起来，很轻很柔地，像是只记得一部分歌词。可是他的声音还是清晰地回响在安静的运河上。而且真是太好听了。一时间我仿佛又回到了童年，回到了那个公寓。
- human_review_status: `PENDING`

### batch1-calib-003 [batch1]
- expected: ['死亡', '轮回']
- audit_reason: 轮回、死亡为原文核心意象；倦怠/痛苦亦强但未列入必选。
- definitions:
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
  - **轮回** (`theme-0057-轮回`): 循环往复、反复发生与生命周而复始的经验。
- quote: 他深深陷入了轮回之流，四面八方的厌恶与死亡被他吸收殆尽，就像一块吸满了水的海绵。他满是倦怠，满是苦痛，满是死亡。
- human_review_status: `PENDING`

### batch1-calib-005 [batch1]
- expected: ['时间']
- audit_reason: 时间被反复主题化（核算、矿藏）。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
- quote: 柳比歇夫的时间酷似物质，从不会了无痕迹地消失，不会平白无故地蒸发，而总能够查明它们变成了什么。借助时间核算，柳比歇夫不断地开采着新的时间。而时间，才是真正的矿藏。
- human_review_status: `PENDING`

### batch1-calib-007 [batch1]
- expected: ['死亡']
- audit_reason: 死亡被明确对比与定义；亦触及绝望/永恒结局。
- definitions:
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
- quote: 为了能够通过搅乱气味、味道的正常秩序唤起自己的警觉，因为他相信，与令人绝望的永恒结局相比，死亡更是一种警告。
- human_review_status: `PENDING`

### batch1-calib-009 [batch1]
- expected: ['记忆', '遗忘']
- audit_reason: 记忆力衰退与遗忘的纪念品意象直接支持记忆/遗忘。
- definitions:
  - **记忆** (`theme-0077-记忆`): 记住、回想与被过去经验塑造的心智领地，可涵盖回忆唤起、保存与改变。
  - **遗忘** (`theme-0078-遗忘`): 记不起、被抹去或主动放下过去。
- quote: 一根位置放错的火柴或帕林卡酒盅本身就是对造成记忆力衰退的破坏性影响的纪念品。
- human_review_status: `PENDING`

### batch1-calib-010 [batch1]
- expected: ['焦虑']
- audit_reason: 焦虑有字面与行为证据；冲动/恐惧曾被接受为可选扩展。
- definitions:
  - **焦虑** (`theme-0104-焦虑`): 担忧、紧张与不安的持续性心理压力。
- quote: 某种无法解释的深深不安会给他注入一针兴奋剂，杯子或铅笔开始在他的手里抖动，焦虑地在日记本里记下想到的话，随后，又以粗莽、激愤的动作用橡皮擦掉。
- human_review_status: `PENDING`

### batch1-calib-012 [batch1]
- expected: ['满足', '占有']
- audit_reason: 满足与掌控/占有均有明确心理描写。
- definitions:
  - **满足** (`theme-0103-满足`): 感到足够、安稳或心意落地的状态。
  - **占有** (`theme-0116-占有`): 对人、物或局面的掌控、据有与不愿放手。
- quote: 有那么几次，当他在由于黄昏的突然降临而变得昏暗的房间里一样样地审视他那些摆放如意的用品时，会感到一股温暖和些许的满足，他意识到所有的一切都在他的掌控之下，他的掌控力无所不在。
- human_review_status: `PENDING`

### batch1-calib-013 [batch1]
- expected: ['死亡']
- audit_reason: 死亡与腐烂直接描写。
- definitions:
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
- quote: 直到他的身体脏器与他解除那份"能够维持彼此交易关系的协议"，直到他的肉和骨头遭到死亡与腐烂的秃鹫的攻击。
- human_review_status: `PENDING`

### batch1-calib-015 [batch1]
- expected: ['废墟', '末日']
- audit_reason: 废墟与末日/天塌地陷意象清楚。
- definitions:
  - **废墟** (`theme-0004-废墟`): 毁坏后的残存空间与历史痕迹。
  - **末日** (`theme-0042-末日`): 世界或既有秩序走向终结的想象与危机感。
- quote: 一支庞大的、衣衫褴褛的队伍在一片沙漠般的荒野里蜿蜒前行，在他们身后是一片笼罩在硝烟和火光之中的天塌地陷、千疮百孔的城市废墟，在他们前方有一块巨大、可怕的虚斑。
- human_review_status: `PENDING`

### batch1-calib-017 [batch1]
- expected: ['虚无']
- audit_reason: 空虚/虚无对照充实生活。
- definitions:
  - **虚无** (`theme-0054-虚无`): 意义空缺、空洞与存在无根基感。
- quote: 这部充满了各种感觉的小说突然被这些不知深浅的漩涡隔断了，犹如你希望生活充实结果却发现了生活中的空虚。
- human_review_status: `PENDING`

### batch1-calib-021 [batch1]
- expected: ['梦']
- audit_reason: 梦境与醒来循环清楚。
- definitions:
  - **梦** (`theme-0071-梦`): 梦境、愿望投射与潜意识显现。
- quote: 你在梦境之中要寻找一种抽象的、绝对的时空，并沿着一条明确的路线前进。但是，当你觉得你快要找到的时候，你却醒了，发现你躺在床上并未动弹，只得一切重新开始。
- human_review_status: `PENDING`

### batch1-calib-023 [batch1]
- expected: ['时间']
- audit_reason: 试图让时针倒转，时间主题明确。
- definitions:
  - **时间** (`theme-0039-时间`): 时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。
- quote: 眼睛盯着挂钟的指针，徒劳地要使那巨大的时针倒转，倒着经历那已经属于过去的时刻。
- human_review_status: `PENDING`

### batch1-calib-025 [batch1]
- expected: ['财富']
- audit_reason: 有钱人/财产直接支持财富。
- definitions:
  - **财富** (`theme-0175-财富`): 富有、占有资源及其道德/社会效应。
- quote: 要知道：有钱人保卫自身或财产的最强大力量，在于下人和邻人对他的敬爱和友爱。
- human_review_status: `PENDING`

### batch1-calib-028 [batch1]
- expected: ['死亡', '名声']
- audit_reason: 死亡与名誉/荣誉代价清楚（名声含荣誉别名）。
- definitions:
  - **死亡** (`theme-0043-死亡`): 生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。
  - **名声** (`theme-0154-名声`): 一个人或群体被认识、评价与记忆的声誉，也包括荣誉及其代价。
- quote: 可见，谁若满载着荣誉断了气，他的亲友该为他去世而欣喜，因为等他令名因年龄而枯槁，那时他的能耐已完全被忘掉。所以如果有人要留个好名誉，那么最好在声名最隆时死去。
- human_review_status: `PENDING`

### batch1-calib-029 [batch1]
- expected: ['命运']
- audit_reason: 命运与接受不可避免情形清楚。
- definitions:
  - **命运** (`theme-0032-命运`): 命运、宿命或更大力量如何牵引人生轨迹，也包括人对这种不可控性的感受。
- quote: 所以我认为明智的做法就是：要自愿地去做非做不可的事，要甘心接受不可避免的情形，特别是我们必然遭遇的命运。
- human_review_status: `PENDING`

### batch2-batch2-008 [batch2]
- expected: ['自杀', '痛苦']
- audit_reason: 自杀与痛苦极致有直接论述。
- definitions:
  - **自杀** (`theme-0052-自杀`): 结束自己生命的意念、行动或其阴影。
  - **痛苦** (`theme-0105-痛苦`): 身体或精神上的受苦、伤痛与难耐体验。
- quote: 我倒要看看，一个人究竟能承受多少不幸！一旦到了痛苦的极致，我只要打开太平门，就能逃走。”许多自杀者都从这种想法中获得非凡的力量。
- human_review_status: `PENDING`

### batch2-batch2-009 [batch2]
- expected: ['幸福']
- audit_reason: 幸福瞬间明确。
- definitions:
  - **幸福** (`theme-0087-幸福`): 感到愉悦、满足或安好；包括具体的快乐时刻和对生活状态的幸福感。
- quote: 这些人虽活得极不安宁，却能在为数不多的幸福瞬间，强烈地经验到难以言状的美好事物。
- human_review_status: `PENDING`

### batch2-batch2-012 [batch2]
- expected: ['孤独', '痛苦']
- audit_reason: 孤独与折磨/冰冷感受清楚。
- definitions:
  - **孤独** (`theme-0090-孤独`): 缺乏联结、被隔绝或无人理解的感受。
  - **痛苦** (`theme-0105-痛苦`): 身体或精神上的受苦、伤痛与难耐体验。
- quote: 在束手无策地渴望温暖中折磨自己是多么可笑！孤独就是独立。多年来，我终于拥有了我一直渴求的孤独。孤独是冰冷的，哦，是的！
- human_review_status: `PENDING`

### batch2-batch2-016 [batch2]
- expected: ['经历', '幸福', '生活']
- audit_reason: 经历的快乐与现实生活对照清楚。
- definitions:
  - **经历** (`theme-0076-经历`): 亲身遭遇的事件、情境与过程，以及它们带来的感受和体会。
  - **幸福** (`theme-0087-幸福`): 感到愉悦、满足或安好；包括具体的快乐时刻和对生活状态的幸福感。
  - **生活** (`theme-0229-生活`): 个人生活的现实处境、日常活动、关系与人生历程；区别于生物意义上的生命。
- quote: 与之相反，我经历的为数不多的快乐，那些愉悦、狂喜、巅峰体验，世人或许最多在文艺作品中见识过、寻觅过、热爱过。而在现实生活中，他们必定认为那不合常理、荒诞不经。
- human_review_status: `PENDING`

### batch2-batch2-026 [batch2]
- expected: ['责任', '罪', '宗教']
- audit_reason: 责任/罪/宗教（亚当禁果赎罪）清楚。
- definitions:
  - **责任** (`theme-0056-责任`): 对他人、角色或后果应承担的义务感。
  - **罪** (`theme-0214-罪`): 过错、罪责或道德/宗教意义上的堕落。
  - **宗教** (`theme-0222-宗教`): 围绕宗教信仰、神圣秩序、仪式与相关价值观的经验和思考。
- quote: 确实不能。他们也不能为亚当偷食禁果负责，但他们不得不为此赎罪。
- human_review_status: `PENDING`

### batch2-batch2-028 [batch2]
- expected: ['混乱', '秩序']
- audit_reason: 混乱无序的笑与规矩/方圆对照清楚。
- definitions:
  - **混乱** (`theme-0166-混乱`): 失序、不可预测与结构崩解。
  - **秩序** (`theme-0170-秩序`): 规则、结构化稳定与其压制面向。
- quote: 她的笑声吓了他一跳。就像她是灌了气的，打开得太快，气泡喷得到处都是。这笑声在灰色水泥和四方地砖之间显得很突兀，这是混乱无序的笑声，规矩不守方圆不成。
- human_review_status: `PENDING`

### batch2-batch2-029 [batch2]
- expected: ['失去']
- audit_reason: 失去有直接陈述。
- definitions:
  - **失去** (`theme-0034-失去`): 无可挽回地丧失人或重要之物/状态。
- quote: 我失去太多了，欧维。感觉我的心就像在身体之外跳动。
- human_review_status: `PENDING`

