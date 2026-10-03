# PGWhite 1.3 Dedup Benchmark Report

**Status:** Research / dry-run only — **ZERO database mutation**  
**Generated:** 2026-10-03T03:00:58.153Z  
**Experimental rule:** `exp_v0_research_only_2026-10-02` (NOT production truth)

## Dataset summary

| Metric | Value |
|--------|------:|
| Seeds | 30 |
| Pairs | 376 |
| DUPLICATE | 187 |
| NOT_DUPLICATE | 137 |
| AMBIGUOUS | 52 |
| Distinct seed quote IDs used | 30 |

### Ground-truth mix

- DUPLICATE: 49.7%
- NOT_DUPLICATE: 36.4%
- AMBIGUOUS: 13.8%

### Mutation-type distribution

- D1_exact: 30
- N1_unrelated: 30
- D2_whitespace: 27
- N2_lexical_overlap_diff_meaning: 25
- D10_sentence_select: 24
- N4_negation: 22
- D4_outer_quotes: 19
- N5_entity_swap: 18
- N3_subject_object_swap: 17
- D6_prefix_expand: 15
- D7_suffix_expand: 15
- D12_small_indel: 14
- D3_unicode_width: 13
- D8_prefix_trunc: 13
- D9_suffix_trunc: 13
- D5_punctuation: 10
- D13_multi_edition: 8
- N6_shared_fragment: 8
- N9_same_text_diff_chapter: 8
- N10_same_text_diff_book: 8
- A5_partial_overlap: 8
- N8_containment_trap: 7
- A1_extra_sentence: 6
- A4_punctuation_tone: 6
- A2_multi_edition_hard: 5
- D11_char_substitution: 4
- A3_short_in_long: 2
- N7_short_collision: 1

## Metric distribution (on research-normalized text)

### full_similarity

- **DUPLICATE** (n=187): min=0.193 median=0.979 p90=1.000 max=1.000
- **NOT_DUPLICATE** (n=137): min=0.000 median=0.980 p90=1.000 max=1.000
- **AMBIGUOUS** (n=52): min=0.000 median=0.883 p90=0.988 max=0.993

### partial_similarity

- **DUPLICATE** (n=187): min=0.848 median=1.000 p90=1.000 max=1.000
- **NOT_DUPLICATE** (n=137): min=0.000 median=0.981 p90=1.000 max=1.000
- **AMBIGUOUS** (n=52): min=0.000 median=0.989 p90=1.000 max=1.000

## False-positive analysis (most dangerous NOT_DUPLICATE)

Ranked by max(full, partial). Structural blocks excluded.

- `C0264_N4_negation` · N4_negation · full=0.950 partial=1.000 lr=0.950 contain=true · pred=likely_duplicate
  - canonical: “是六天九小时二十七分。​”飞船修正道。
  - candidate: “不是六天九小时二十七分。​”飞船修正道。
- `C0286_N2_lexical_overlap_diff_meaning` · N2_lexical_overlap_diff_meaning · full=0.994 partial=0.994 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 后来，加缪又在《局外人》英译本的序言中，对这个人物作出一连串的赞词：“他不耍花招，从这个意义上说，他是他所生活的那个社会…
  - candidate: 后来，加缪又在《局外人》英译本的序言中，对这个人物作出两连串的赞词：“他不耍花招，从这个意义上说，他是他所生活的那个社会…
- `C0288_N4_negation` · N4_negation · full=0.994 partial=0.994 lr=0.994 contain=false · pred=likely_duplicate
  - canonical: 后来，加缪又在《局外人》英译本的序言中，对这个人物作出一连串的赞词：“他不耍花招，从这个意义上说，他是他所生活的那个社会…
  - candidate: 后来，加缪又在《局外人》英译本的序言中，对这个人物作出一连串的赞词：“他不耍花招，从这个意义上说，他不是他所生活的那个社…
- `C0289_N5_entity_swap` · N5_entity_swap · full=0.994 partial=0.994 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 后来，加缪又在《局外人》英译本的序言中，对这个人物作出一连串的赞词：“他不耍花招，从这个意义上说，他是他所生活的那个社会…
  - candidate: 后来，加缪又在《局外人》英译本的序言中，对这个人物作出两连串的赞词：“他不耍花招，从这个意义上说，他是他所生活的那个社会…
- `C0304_N4_negation` · N4_negation · full=0.993 partial=0.993 lr=0.993 contain=false · pred=likely_duplicate
  - canonical: 浮士德曾说过一句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其…
  - candidate: 浮士德曾说过一句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其…
- `C0302_N2_lexical_overlap_diff_meaning` · N2_lexical_overlap_diff_meaning · full=0.993 partial=0.993 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 浮士德曾说过一句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其…
  - candidate: 浮士德曾说过两句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其…
- `C0305_N5_entity_swap` · N5_entity_swap · full=0.993 partial=0.993 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 浮士德曾说过一句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其…
  - candidate: 浮士德曾说过两句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其…
- `C0249_N2_lexical_overlap_diff_meaning` · N2_lexical_overlap_diff_meaning · full=0.992 partial=0.992 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把一把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
  - candidate: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把两把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
- `C0251_N5_entity_swap` · N5_entity_swap · full=0.992 partial=0.992 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把一把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
  - candidate: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把两把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
- `C0260_N2_lexical_overlap_diff_meaning` · N2_lexical_overlap_diff_meaning · full=0.990 partial=0.990 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 这种笔调胜过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持一种超然物外的态度。我绝非如诸位所想象…
  - candidate: 这种笔调胜过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持两种超然物外的态度。我绝非如诸位所想象…
- `C0261_N3_subject_object_swap` · N3_subject_object_swap · full=0.990 partial=0.990 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 这种笔调胜过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持一种超然物外的态度。我绝非如诸位所想象…
  - candidate: 这种笔调胜过千言万语的辩解，瞬间就让她们明白，对于“昨日那些不堪回首的往事”，我持一种超然物外的态度。我绝非如诸位所想象…
- `C0262_N5_entity_swap` · N5_entity_swap · full=0.990 partial=0.990 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: 这种笔调胜过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持一种超然物外的态度。我绝非如诸位所想象…
  - candidate: 这种笔调胜过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持两种超然物外的态度。我绝非如诸位所想象…
- `C0281_N4_negation` · N4_negation · full=0.990 partial=0.990 lr=0.990 contain=false · pred=likely_duplicate
  - canonical: “不过，当然了，这也并不意味着偶尔就不会有这种的时候—在极其孤独的时刻—你会想要对自己说：‘我的人生中犯了个多么可怕的错…
  - candidate: “不过，当然了，这也并不意味着偶尔就不不会有这种的时候—在极其孤独的时刻—你会想要对自己说：‘我的人生中犯了个多么可怕的…
- `C0280_N2_lexical_overlap_diff_meaning` · N2_lexical_overlap_diff_meaning · full=0.989 partial=0.989 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: “不过，当然了，这也并不意味着偶尔就不会有这种的时候—在极其孤独的时刻—你会想要对自己说：‘我的人生中犯了个多么可怕的错…
  - candidate: “不过，当然了，这也并不意味着偶尔就不会有这种的时候—在极其孤独的时刻—你会想要对自己说：‘我的人生中犯了个多么可怕的错…
- `C0282_N5_entity_swap` · N5_entity_swap · full=0.989 partial=0.989 lr=1.000 contain=false · pred=likely_duplicate
  - canonical: “不过，当然了，这也并不意味着偶尔就不会有这种的时候—在极其孤独的时刻—你会想要对自己说：‘我的人生中犯了个多么可怕的错…
  - candidate: “不过，当然了，这也并不意味着偶尔就不会有这种的时候—在极其孤独的时刻—你会想要对自己说：‘我的人生中犯了个多么可怕的错…

## False-negative analysis (DUPLICATE with low full_similarity)

- `C0165_D10_sentence_select` · D10_sentence_select · full=0.193 partial=1.000 lr=0.193 contain=true · pred=possible_duplicate
  - canonical: 他们脚底下的“手掌”颤动着，朝下坠落五米，几乎将他们颠进空中，然后再次颤动起来。耳畔传来一阵隆隆声，好似巨型建筑倒塌，又…
  - candidate: 布劳恩很明显地感觉到，云门是在笑。
- `C0178_D10_sentence_select` · D10_sentence_select · full=0.198 partial=1.000 lr=0.198 contain=true · pred=possible_duplicate
  - canonical: 书是一种点状的、粉末状的物质。在洋洋洒洒的文字之中，读者只能注意到最小的片断、词组、譬喻、句法联系、逻辑关系，以及具有丰…
  - candidate: 这些东西好比构成作品核心的基本粒子
- `C0176_D10_sentence_select` · D10_sentence_select · full=0.209 partial=1.000 lr=0.209 contain=true · pred=possible_duplicate
  - canonical: 恋人和诗人对爱的力量怀有永恒的信念，认为它比死亡还要持久，但那句千百年来一直缠着我们不放的“生命虽尽，爱犹未尽”，实际上…
  - candidate: 这句谎言只是徒劳无益，并非荒唐可笑。
- `C0173_D10_sentence_select` · D10_sentence_select · full=0.239 partial=1.000 lr=0.239 contain=true · pred=possible_duplicate
  - canonical: 这些群众听到这蒸汽呼哨出来的歌声，个个兴奋得不能自制，美国人大声呼叫：“呼啦！”德国人高喊：“啊嘿！”墨西哥人则是叫着：…
  - candidate: ”卡菲拉人高兴得像野兽得到美味那样狂呼乱叫。
- `C0171_D10_sentence_select` · D10_sentence_select · full=0.246 partial=1.000 lr=0.246 contain=true · pred=possible_duplicate
  - canonical: 这个系统会分析：“这是适合领略美的环境吗？如果是，那就欣赏吧；如果不是，那就忽略吧。”但这样就圆满了吗？这就是人们谈论的…
  - candidate: 这就是人们谈论的“辅助性成熟”吗？
- `C0172_D10_sentence_select` · D10_sentence_select · full=0.269 partial=1.000 lr=0.269 contain=true · pred=possible_duplicate
  - canonical: 舞台的布景，晚上看起来是那样的辉煌动人，白天阳光一照，却成了一幅拙劣的绘画。生活中也往往出现类似的现象。
  - candidate: 生活中也往往出现类似的现象。
- `C0159_D10_sentence_select` · D10_sentence_select · full=0.286 partial=1.000 lr=0.286 contain=true · pred=possible_duplicate
  - canonical: 他深深陷入了轮回之流，四面八方的厌恶与死亡被他吸收殆尽，就像一块吸满了水的海绵。他满是倦怠，满是苦痛，满是死亡。
  - candidate: 他满是倦怠，满是苦痛，满是死亡。
- `C0175_D10_sentence_select` · D10_sentence_select · full=0.297 partial=1.000 lr=0.297 contain=true · pred=possible_duplicate
  - canonical: 浮士德曾说过一句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其…
  - candidate: 一个人的胸膛、身躯向来只有一个，但居住其中的，却绝不止两个或五个灵魂，而是无数个灵魂。
- `C0168_D10_sentence_select` · D10_sentence_select · full=0.340 partial=1.000 lr=0.340 contain=true · pred=possible_duplicate
  - canonical: “不过，当然了，这也并不意味着偶尔就不会有这种的时候—在极其孤独的时刻—你会想要对自己说：‘我的人生中犯了个多么可怕的错…
  - candidate: ’而且你会开始想象一种不同的生活，一种你原本可能拥有的更好的生活。
- `C0156_D10_sentence_select` · D10_sentence_select · full=0.429 partial=1.000 lr=0.429 contain=true · pred=possible_duplicate
  - canonical: 我很伤心，不是因为她冲我大声嚷嚷，而是因为我知道那是托尼·加德纳的唱片，我知道那张唱片对她来说多么重要。我还知道从此以后…
  - candidate: 我还知道从此以后，当加德纳轻声吟唱那些美国歌曲时，唱片就会发出"嗞嗞"的声音。
- `C0170_D10_sentence_select` · D10_sentence_select · full=0.438 partial=1.000 lr=0.438 contain=true · pred=possible_duplicate
  - canonical: 后来，加缪又在《局外人》英译本的序言中，对这个人物作出一连串的赞词：“他不耍花招，从这个意义上说，他是他所生活的那个社会…
  - candidate: 他拒绝矫饰自己的感情，于是社会就感到受到了威胁”，“他是穷人，是坦诚的人，喜爱光明正大”，“一个无任何英雄行为而自愿为真…
- `C0162_D10_sentence_select` · D10_sentence_select · full=0.495 partial=1.000 lr=0.495 contain=true · pred=possible_duplicate
  - canonical: 这种笔调胜过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持一种超然物外的态度。我绝非如诸位所想象…
  - candidate: 我绝非如诸位所想象的那般被打击得魂飞魄散，相反，我以一个懂得自重的绅士所应有的从容与淡定来看待此事。
- `C0158_D10_sentence_select` · D10_sentence_select · full=0.540 partial=1.000 lr=0.540 contain=true · pred=possible_duplicate
  - canonical: 他如同一个吃得太多、喝得太撑之人，想要将一切在痛苦中呕吐出去，只为换来一丝解脱。他渴望以一场巨大的呕吐，将所有的欢愉、所…
  - candidate: 他渴望以一场巨大的呕吐，将所有的欢愉、所有的习性、这荒唐无意的生活，连同他自己一并抛洒、清空。
- `C0179_D10_sentence_select` · D10_sentence_select · full=0.557 partial=1.000 lr=0.557 contain=true · pred=likely_duplicate
  - canonical: 用她的话说，理想的作家就是像“南瓜秧子结南瓜”一样创作的作家。她还用了一些别的顺应自然过程的隐喻，像风沿山坡走、潮水有涨…
  - candidate: 她还用了一些别的顺应自然过程的隐喻，像风沿山坡走、潮水有涨落、年轮不瞒树龄等。
- `C0160_D10_sentence_select` · D10_sentence_select · full=0.636 partial=1.000 lr=0.636 contain=true · pred=likely_duplicate
  - canonical: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把一把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
  - candidate: 施密特的困意上来了，趴在桌子上开始打起呼噜，妇人则从餐具柜后面拉出一只带铁箍的军用木箱，掸掉上面的灰尘，将箱子里面也擦拭…

## Ambiguous cases (sample)

- `C0354_A1_extra_sentence` · A1_extra_sentence · full=0.860 partial=1.000 lr=0.860 contain=true · pred=likely_duplicate
  - canonical: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把一把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
  - candidate: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把一把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
- `C0370_A5_partial_overlap` · A5_partial_overlap · full=0.830 partial=1.000 lr=0.830 contain=true · pred=likely_duplicate
  - canonical: 我说我不想叨扰他，可是加德纳先生的语气里有丝丝温和的坚持。"不会，不会，坐下。你刚才说你母亲喜欢我的唱片。"
  - candidate: 叨扰他，可是加德纳先生的语气里有丝丝温和的坚持。"不会，不会，坐下。你刚才说你母亲喜欢我
- `C0372_A5_partial_overlap` · A5_partial_overlap · full=0.821 partial=1.000 lr=0.821 contain=true · pred=likely_duplicate
  - canonical: 他深深陷入了轮回之流，四面八方的厌恶与死亡被他吸收殆尽，就像一块吸满了水的海绵。他满是倦怠，满是苦痛，满是死亡。
  - candidate: 了轮回之流，四面八方的厌恶与死亡被他吸收殆尽，就像一块吸满了水的海绵。他满是倦怠，满是苦痛，
- `C0375_A5_partial_overlap` · A5_partial_overlap · full=0.820 partial=1.000 lr=0.820 contain=true · pred=likely_duplicate
  - canonical: 因此，这位主人公所具有的双重身份就显得意味深长：“他既是时代的控诉者，又是被时代和历史所控诉的对象。”
  - candidate: 主人公所具有的双重身份就显得意味深长：“他既是时代的控诉者，又是被时代和历史所控诉
- `C0374_A5_partial_overlap` · A5_partial_overlap · full=0.882 partial=1.000 lr=0.882 contain=true · pred=likely_duplicate
  - canonical: 施密特从风雨衣的内侧口袋里掏出一个用麻绳捆着、塞得鼓鼓囊囊、已被汗水浸湿的信封。"等一下，"施密特夫人喊住丈夫，迅速用一…
  - candidate: 雨衣的内侧口袋里掏出一个用麻绳捆着、塞得鼓鼓囊囊、已被汗水浸湿的信封。"等一下，"施密特夫人喊住丈夫，迅速用一块搌布把桌…
- `C0371_A5_partial_overlap` · A5_partial_overlap · full=0.885 partial=1.000 lr=0.885 contain=true · pred=likely_duplicate
  - canonical: 他如同一个吃得太多、喝得太撑之人，想要将一切在痛苦中呕吐出去，只为换来一丝解脱。他渴望以一场巨大的呕吐，将所有的欢愉、所…
  - candidate: 吃得太多、喝得太撑之人，想要将一切在痛苦中呕吐出去，只为换来一丝解脱。他渴望以一场巨大的呕吐，将所有的欢愉、所有的习性、…
- `C0369_A5_partial_overlap` · A5_partial_overlap · full=0.890 partial=1.000 lr=0.890 contain=true · pred=likely_duplicate
  - canonical: 我很伤心，不是因为她冲我大声嚷嚷，而是因为我知道那是托尼·加德纳的唱片，我知道那张唱片对她来说多么重要。我还知道从此以后…
  - candidate: 不是因为她冲我大声嚷嚷，而是因为我知道那是托尼·加德纳的唱片，我知道那张唱片对她来说多么重要。我还知道从此以后，当加德纳…
- `C0357_A2_multi_edition_hard` · A2_multi_edition_hard · full=0.897 partial=0.963 lr=0.914 contain=false · pred=likely_duplicate
  - canonical: 我说我不想叨扰他，可是加德纳先生的语气里有丝丝温和的坚持。"不会，不会，坐下。你刚才说你母亲喜欢我的唱片。"
  - candidate: 她想：“我说我不想叨扰他也，可是加德纳先生的语气里有丝丝温和的坚持！"不会，不会，坐下。你刚才说你母亲喜欢我的唱片。"”
- `C0376_A5_partial_overlap` · A5_partial_overlap · full=0.901 partial=1.000 lr=0.901 contain=true · pred=likely_duplicate
  - canonical: 这种笔调胜过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持一种超然物外的态度。我绝非如诸位所想象…
  - candidate: 过千言万语的辩解，瞬间就让他们明白，对于“昨日那些不堪回首的往事”，我持一种超然物外的态度。我绝非如诸位所想象的那般被打…
- `C0359_A2_multi_edition_hard` · A2_multi_edition_hard · full=0.902 partial=0.965 lr=0.918 contain=false · pred=likely_duplicate
  - canonical: 他深深陷入了轮回之流，四面八方的厌恶与死亡被他吸收殆尽，就像一块吸满了水的海绵。他满是倦怠，满是苦痛，满是死亡。
  - candidate: 她想：“他深深陷入了轮回之流也，四面八方的厌恶与死亡被他吸收殆尽，就像一块吸满了水的海绵！他满是倦怠，满是苦痛，满是死亡…
- `C0356_A2_multi_edition_hard` · A2_multi_edition_hard · full=0.917 partial=0.935 lr=0.948 contain=false · pred=possible_duplicate
  - canonical: 我很伤心，不是因为她冲我大声嚷嚷，而是因为我知道那是托尼·加德纳的唱片，我知道那张唱片对她来说多么重要。我还知道从此以后…
  - candidate: 她想：“我很伤心也，不是由于她冲我大声嚷嚷，而是因为我知道那是托尼·加德纳的唱片，我知道那张唱片对她来说多么重要！我还知…
- `C0373_A5_partial_overlap` · A5_partial_overlap · full=0.922 partial=1.000 lr=0.922 contain=true · pred=likely_duplicate
  - canonical: 他们决定，他们将在这里，在厨房里等到天黑。弗塔基把一把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌…
  - candidate: 他们将在这里，在厨房里等到天黑。弗塔基把一把椅子拉到窗户跟前，眼睛盯着街对面的房子。施密特的困意上来了，趴在桌子上开始打…

## Structural-rule validation

| Rule | Cases | Structurally blocked | Pass? |
|------|------:|---------------------:|:-----:|
| N9 same text / different chapter | 8 | 8 | YES |
| N10 same text / different book | 8 | 8 | YES |

Note: textual scorers may still show full_similarity=1.0 on these rows; the experimental classifier must reject via Book/Chapter gates.

## Mutation-family notes

- **Boundary (D6–D9):** typically high partial_similarity; full_similarity drops with expansion size.
- **Edition-like (D11–D13):** watch overlap with N2/N4/N5 hard negatives.
- **Short (N7):** similarity scores are unreliable — inspect length_ratio.
- **Negation (N4):** high character overlap with opposite meaning — critical FP risk.
- **Containment (N8/A3):** partial_similarity can hit 1.0 without identity.

## How to read this

1. Open `benchmark-results.csv` for every pair + features.
2. Use this Markdown for clustered inspection.
3. Do **not** treat experimental bands as a shipping threshold.
4. Real-user WeRead cross-edition data will be required before production calibration.

## Limitations

- Controlled mutations of Daniel’s curated Chinese corpus — not a universal user sample.
- Neighboring literary context for expansions is synthetic discourse wrapping (no full ebook text).
- Chapter labels are real WeRead chapterUid when joinable, else synthetic stable labels for gating tests.
