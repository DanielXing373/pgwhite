import fs from 'node:fs';
import path from 'node:path';
import { buildRepresentations } from '../src/representations.mjs';

const root = process.cwd();
const basePath = 'research/tag-library/data/library/atomic-tag-library.v1.42.json';
const libraryOut = 'research/tag-library/data/library/atomic-tag-library.v1.43.json';
const repsOut = 'research/tag-library/data/library/representations.v1.43.json';
const fixtureOut = 'research/retrieval/benchmark/fixtures/quotes-batch2.v1.43-dev.json';
const createdAt = '2026-10-11T12:00:00.000Z';
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, value) => fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + '\n', 'utf8');

const cambridge = {
  literature: 'https://dictionary.cambridge.org/dictionary/english/literature',
  technology: 'https://dictionary.cambridge.org/dictionary/english/technology',
  goal: 'https://dictionary.cambridge.org/dictionary/english/goal',
  complexity: 'https://dictionary.cambridge.org/dictionary/english/complexity',
  happiness: 'https://dictionary.cambridge.org/dictionary/english/happiness',
  learning: 'https://dictionary.cambridge.org/dictionary/english/learning',
  thought: 'https://dictionary.cambridge.org/dictionary/english/thought',
  thinking: 'https://dictionary.cambridge.org/dictionary/english/thinking',
  experience: 'https://dictionary.cambridge.org/dictionary/english/experience',
  humor: 'https://dictionary.cambridge.org/dictionary/english/humor',
  present: 'https://dictionary.cambridge.org/dictionary/english/present',
  life: 'https://dictionary.cambridge.org/dictionary/english/life',
  pathological: 'https://dictionary.cambridge.org/dictionary/english/pathological',
  beauty: 'https://dictionary.cambridge.org/dictionary/english/beauty',
};

const lib = read(basePath);
const themes = structuredClone(lib.themes);
const byName = new Map(themes.map(t => [t.canonical_zh, t]));
function updateTheme(oldName, canonical, { definition, aliases = [], sourceRefs = [] }) {
  const t = byName.get(oldName);
  if (!t) throw new Error(`Missing Theme to update: ${oldName}`);
  const suffix = t.id.match(/theme-(\d+)/)?.[1];
  if (!suffix) throw new Error(`Unexpected Theme ID: ${t.id}`);
  byName.delete(oldName);
  t.id = `theme-${suffix}-${canonical}`;
  t.canonical_zh = canonical;
  t.aliases = [...new Set([...(t.aliases || []), oldName, ...aliases].filter(a => a !== canonical))];
  t.definition = definition;
  t.source_refs = [...new Set([...(t.source_refs || []), ...sourceRefs])];
  t.provenance = [...new Set([...(t.provenance || []), 'manual'])];
  t.notes = `v1.43 terminology revision from the user's second reviewed quote batch; previous label retained as an alias.`;
  byName.set(canonical, t);
}

updateTheme('书籍', '文学', {
  definition: '文学作品及其阅读、书写与审美或思想经验。',
  aliases: ['阅读'], sourceRefs: [cambridge.literature],
});
updateTheme('技术', '科技', {
  definition: '科学知识及其实际应用形成的方法、工具与技术变化。',
  aliases: ['技术'], sourceRefs: [cambridge.technology],
});
updateTheme('适应', '接受', {
  definition: '承认并接纳难以改变的事实或处境，减少抗拒并继续应对。',
  aliases: ['顺应'],
});
updateTheme('经验', '经历', {
  definition: '亲身遭遇的事件、情境与过程，以及它们带来的感受和体会。',
  aliases: ['阅历', '经验'], sourceRefs: [cambridge.experience],
});
updateTheme('喜悦', '幸福', {
  definition: '感到愉悦、满足或安好；包括具体的快乐时刻和对生活状态的幸福感。',
  aliases: ['快乐', '欢喜', '喜悦', '幸福感'], sourceRefs: [cambridge.happiness],
});
// Keep 求学 under 学习 rather than duplicating it on 教育.
byName.get('教育').aliases = (byName.get('教育').aliases || []).filter(a => a !== '求学');
// Merge 孩子 into 童年 as requested; preserve the old surface forms as aliases.
const child = byName.get('孩子');
const childhood = byName.get('童年');
if (!child || !childhood) throw new Error('Missing Theme for 孩子→童年 merge');
childhood.aliases = [...new Set([...(childhood.aliases || []), child.canonical_zh, ...(child.aliases || [])])];
byName.delete('孩子');
themes.splice(themes.indexOf(child), 1);

const aliasTargets = {
  痛苦: ['折磨'],
  责任: ['负责'],
  秩序: ['规矩'],
};
for (const [target, additions] of Object.entries(aliasTargets)) {
  const t = byName.get(target);
  if (!t) throw new Error(`Missing alias target: ${target}`);
  t.aliases = [...new Set([...(t.aliases || []), ...additions])];
}
// The source label 自我 remains an alias of the broader active Theme.

const additions = [
  { name: '目标', en: 'Goal', definition: '行动、选择或愿望所指向的目的、追求与预期成果。', aliases: ['目的', '追求'], category: '自我', parents: ['自我'], sources: [cambridge.goal] },
  { name: '复杂性', en: 'Complexity', definition: '由多个相互作用的层面或因素构成，因而难以简单理解的性质。', aliases: ['复杂'], category: '认知', parents: ['认知'], sources: [cambridge.complexity] },
  { name: '学习', en: 'Learning', definition: '通过学习、实践或经验获得知识、技能与理解的过程。', aliases: ['求学'], category: '认知', parents: ['认知'], sources: [cambridge.learning] },
  { name: '幽默', en: 'Humor', definition: '对可笑、荒诞或反差的感受、表达与观察。', aliases: ['诙谐', '幽默感'], category: '审美', parents: ['审美'], sources: [cambridge.humor] },
  { name: '当下', en: 'Present Moment', definition: '正在发生的现在，以及对即时现实或此刻经验的关注。', aliases: ['此刻', '现在'], category: '存在', parents: ['存在'], sources: [cambridge.present] },
  { name: '病态', en: 'Pathology', definition: '被描写为不健康、失常或难以自控的心理倾向、行为或关系状态。', aliases: ['病态心理', '病态行为'], category: '身心', parents: ['身心'], sources: [cambridge.pathological] },
  { name: '生活', en: 'Life Experience', definition: '个人生活的现实处境、日常活动、关系与人生历程；区别于生物意义上的生命。', aliases: ['人生', '日常生活'], category: '存在', parents: ['存在'], sources: [cambridge.life] },
  { name: '思考', en: 'Thought', definition: '围绕事物形成想法、理解或判断的心智活动。', aliases: ['思索', '思想'], category: '认知', parents: ['认知'], sources: [cambridge.thought, cambridge.thinking] },
  { name: '美好', en: 'The Good and Beautiful', definition: '被认为值得珍视、向往或赞赏的事物与状态；不只指外在美感。', aliases: ['美好事物'], category: '审美', parents: ['审美'], sources: [cambridge.beauty] },
];
const maxSuffix = Math.max(...themes.map(t => Number(t.id.match(/theme-(\d+)/)?.[1] || 0)));
for (let i = 0; i < additions.length; i++) {
  const a = additions[i];
  if (byName.has(a.name)) throw new Error(`Theme already exists: ${a.name}`);
  const id = `theme-${String(maxSuffix + i + 1).padStart(4, '0')}-${a.name}`;
  const tag = {
    id, canonical_zh: a.name, label_en: a.en, dimension: 'theme',
    definition: a.definition, aliases: a.aliases, related: [], parents: a.parents,
    category: a.category, provenance: ['manual'], source_refs: a.sources,
    status: 'active_candidate',
    notes: 'Added for v1.43 from user-reviewed quote annotations; definition is an operational retrieval draft synthesized with the cited dictionary entry.',
  };
  themes.push(tag);
  byName.set(a.name, tag);
}

const renamedLabels = new Map([['书籍', '文学'], ['技术', '科技'], ['适应', '接受'], ['经验', '经历'], ['喜悦', '幸福'], ['孩子', '童年']]);
for (const t of themes) t.related = [...new Set((t.related || []).map(label => renamedLabels.get(label) || label))];
for (const t of themes) t.representations = buildRepresentations(t);
const categoryCounts = {};
for (const t of themes) categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
const outLib = structuredClone(lib);
outLib.library_version = 'atomic-tag-library.v1.43';
outLib.created_at = createdAt;
outLib.research_only = true;
outLib.production_migration = false;
outLib.themes = themes;
outLib.counts.themes_total = themes.length;
outLib.counts.themes_active_candidate = themes.filter(t => t.status === 'active_candidate').length;
outLib.counts.themes_excluded_or_other = themes.length - outLib.counts.themes_active_candidate;
outLib.category_distribution_themes = categoryCounts;
outLib.provenance_counts_themes = {};
for (const t of themes) for (const p of t.provenance) outLib.provenance_counts_themes[p] = (outLib.provenance_counts_themes[p] || 0) + 1;
write(libraryOut, outLib);

const representations = {
  schema_version: 'tag-representations.v1', library_version: outLib.library_version,
  created_at: createdAt, embedding_status: 'not_computed',
  note: 'v1.43 representations. Related concepts are excluded from C.',
  formats: { A: 'canonical label only', B: 'label + definition', C: 'label + definition + aliases (related excluded)' },
  themes: themes.map(t => ({ id: t.id, canonical_zh: t.canonical_zh, A: t.representations.A_label, B: t.representations.B_label_definition, C: t.representations.C_label_definition_aliases })),
  devices: lib.devices.map(t => ({ id: t.id, canonical_zh: t.canonical_zh, A: t.representations.A_label, B: t.representations.B_label_definition, C: t.representations.C_label_definition_aliases })),
};
write(repsOut, representations);

const quotes = [
  ['你茫然地向周围的图书又看了一眼，便走出书店(或者说得更确切些，周围的图书怏怏地望着你走开，仿佛一只只丢失后被收容在市政府特意设置的笼子里的狗，看见一个同伴被其主人认领后牵着链子救走了)。', ['文学']],
  ['今天写长篇小说也许是自相矛盾，时间的维度被打碎了，我们只能在时间的碎片中爱和思考，每一个时间的碎片沿着自己的轨迹运行，在瞬间消失。', ['文学', '时间', '爱情', '思考']],
  ['但是我生活中的每个时刻都是由一些新的事件组成的，而每个新的事件又必然带来新的后果，因此我愈想回复到最初的“零”位置，反而离开这个位置愈远。', ['生活', '目标']],
  ['每一门科学都有其相应的伪科学，由某种特殊类型的头脑所产生的怪诞扭曲形式，天文学有占星术这一滑稽模仿的伴侣，而化学则曾经有过炼金术。', ['科技']],
  ['当所有可研究的东西都被研究完了的时候，教条主义和学术僵化就会接踵而至。', ['人性', '科技']],
  ['能力非凡且个性坚强的人降生的频率多少是恒定的，只是他们的选择不均匀。', ['智慧', '人性', '选择']],
  ['仿佛值得尊敬的做法就是硬着头皮往前走，陷入一片泥潭，在你不理解而且永远都不会理解的东西里活活淹死。', ['接受', '命运']],
  ['我倒要看看，一个人究竟能承受多少不幸！一旦到了痛苦的极致，我只要打开太平门，就能逃走。”许多自杀者都从这种想法中获得非凡的力量。', ['痛苦', '自杀']],
  ['这些人虽活得极不安宁，却能在为数不多的幸福瞬间，强烈地经验到难以言状的美好事物。', ['幸福']],
  ['他爱人或被爱时，也令别人不幸。因为所有爱他的人，总是只看到他的一面。有些人爱他，视他为正派、聪明而优雅的人，一旦发现他身上的狼性，就既吃惊又失望。', ['复杂性', '爱情', '幸福']],
  ['智力好的人能学会的东西，他学了不少，是个相当聪明的人。但他学不会的，却是对自己和生活感到满意。', ['满足', '智慧', '生活', '学习']],
  ['在束手无策地渴望温暖中折磨自己是多么可笑！孤独就是独立。多年来，我终于拥有了我一直渴求的孤独。孤独是冰冷的，哦，是的！', ['孤独', '痛苦']],
  ['全部的文字意味着一次地狱之旅，一次时而忧惧时而英勇的旅行，在幽暗的灵魂世界的混沌中，以意志穿越地狱，直面混沌，忍受邪恶，直至终点。', ['文学', '恐惧', '意志', '善恶', '勇气']],
  ['恋人和诗人对爱的力量怀有永恒的信念，认为它比死亡还要持久，但那句千百年来一直缠着我们不放的“生命虽尽，爱犹未尽”，实际上不过是一句谎言。这句谎言只是徒劳无益，并非荒唐可笑。', ['文学', '爱情', '时间', '死亡', '生命']],
  ['浮士德曾说过一句教师们十分熟悉，庸人们分外赞赏的话：“啊，我胸中住着两个灵魂！”但他忘了，他胸中还住着梅菲斯特和一大群其他灵魂。我们的荒原狼也认为他胸中住着两个灵魂（狼和人），还认为他的胸膛因此拥挤不堪。一个人的胸膛、身躯向来只有一个，但居住其中的，却绝不止两个或五个灵魂，而是无数个灵魂。', ['文学', '灵魂', '复杂性', '身体']],
  ['与之相反，我经历的为数不多的快乐，那些愉悦、狂喜、巅峰体验，世人或许最多在文艺作品中见识过、寻觅过、热爱过。而在现实生活中，他们必定认为那不合常理、荒诞不经。', ['经历', '幸福', '生活']],
  ['孩子们也绝不是幸福的，他们也有种种矛盾、种种分裂，承受着种种痛苦。', ['童年', '痛苦', '幸福', '复杂性']],
  ['幽默是那些在完成伟大使命的过程中重重受阻，那些接近成为悲剧人物、不幸的非凡人物的美妙发明。', ['幽默', '痛苦', '幸福']],
  ['他们的理想不是献身，而是自保。他们所追求的既不是神圣性，亦不是神圣性的对立面。一切绝对性他们都难以承受。他们虽侍奉上帝，却也贪图享乐，虽志愿品行端正，却也要在尘世中享有轻松舒适。', ['人性', '痛苦', '目标', '复杂性']],
  ['但是，每个真实行动的画面、真正情感的力量，即便无人知晓，无人看见，无人为后人记录保存下来，也隶属永恒。在永恒中，没有后世，唯有当下。', ['时间', '当下', '观察']],
  ['如果你为了美好事物和理想战斗，并认为你一定会成功，那倒要平庸得多。难道理想都能实现？我们人活着，难道是为战胜死亡？不，我们活着，是为畏惧死亡，再爱上它。正因为它，微弱的生命才绽放短暂的光芒。', ['目标', '人性', '美好', '死亡', '生活']],
  ['因此父亲和欧维从来没有过多的交谈，但他们喜欢彼此的陪伴。沉默地分别坐在餐桌的两端就很满足。', ['父亲', '亲情', '表达', '疏离', '满足']],
  ['如果生命终将结束于坟墓中，我们又为何致力于艰辛地塑造自我，探索永恒？', ['生活', '生命', '时间', '死亡', '目标', '自我身份']],
  ['这邪恶的金属漏斗果然喷出嚼烂的橡胶和支气管黏液的混合物，喷出留声机的拥有者和收音机用户们齐声称为“音乐”的东西', ['科技', '音乐', '厌恶']],
  ['涂红的嘴唇在毫无血色的脸上越来越红。这副僵硬的嘴唇就像我的一生，像我可怜的幸福和爱情：一点红，画在一张死人的脸上。', ['幸福', '爱情'], '用户标注“绝望痛苦一类”较宽泛；暂不计入Recall必选标签，保留为待确认的可接受候选：绝望、痛苦。'],
  ['确实不能。他们也不能为亚当偷食禁果负责，但他们不得不为此赎罪。', ['罪', '责任', '宗教']],
  ['我几乎错过了她们每一个人，跌跌撞撞，逃之夭夭，随后将她们遗忘——但在这里，她们被保存下来，一个不缺，数以百计。现在我看见她们，献身于她们，沉沦于她们玫瑰色的昏暗的阴曹地府。', ['病态', '爱情', '孤独', '死亡', '遗忘', '记忆']],
  ['她的笑声吓了他一跳。就像她是灌了气的，打开得太快，气泡喷得到处都是。这笑声在灰色水泥和四方地砖之间显得很突兀，这是混乱无序的笑声，规矩不守方圆不成。', ['混乱', '秩序']],
  ['我失去太多了，欧维。感觉我的心就像在身体之外跳动。', ['失去']],
];
const userSurfaceOverrides = {
  2: ['文学', '时间', '爱', '思考'],
  16: ['经历', '快乐', '生活'],
  23: ['生活', '生命', '时间', '死亡', '目标', '自我'],
  25: ['幸福', '爱情', '绝望痛苦一类'],
};

const fixture = {
  schema_version: 'retrieval-benchmark.v1',
  benchmark_version: 'quotes-batch2.v1.43-development',
  created_at: createdAt,
  research_only: true,
  calibration: true,
  exploratory: false,
  status: 'development',
  notes: [
    '29 user-annotated quotes from the second batch; quote numbering is normalized to 001–029.',
    'This batch informed v1.43 terminology, aliases, and additions, so it is a development set and not an independent confirmation set.',
    "Expected labels represent the user's chosen core Themes. Broad/uncertain wording on quote 25 is preserved in notes and excluded from required recall.",
    'Empty expected Themes are not present in this positive-only batch; it cannot measure false-positive behavior on no-Theme quotes.',
  ],
  quotes: quotes.map(([text, labels, notes], index) => {
    const ids = labels.map(label => {
      const theme = byName.get(label);
      if (!theme || theme.status !== 'active_candidate') throw new Error(`Unknown expected label ${label} in quote ${index + 1}`);
      return theme.id;
    });
    return {
      quote_id: `batch2-${String(index + 1).padStart(3, '0')}`,
      text_zh: text,
      source: '用户提供的第二批quote.txt',
      category: 'user_annotated_batch_2',
      test_purpose: ids.length > 1 ? 'multi_theme' : 'single_theme',
      expected_theme_ids: ids,
      expected_theme_labels: labels,
      user_annotation_surfaces: userSurfaceOverrides[index + 1] || labels,
      ambiguity_flags: notes ? ['benchmark_ambiguity'] : [],
      notes: notes || 'User-provided manual Theme annotation; mapped to active v1.43 canonical Theme IDs.',
    };
  }),
};
write(fixtureOut, fixture);

for (const representation of ['B', 'C']) {
  const config = {
    schema_version: 'retrieval-config.v1',
    config_id: `quotes-batch2-v1.43-qwen-${representation}`,
    research_only: true,
    dimension: 'theme',
    tag_library_path: libraryOut,
    active_status: 'active_candidate',
    benchmark_path: fixtureOut,
    representation,
    provider: {
      id: 'qwen3',
      options: {
        model: 'Qwen/Qwen3-Embedding-0.6B', normalize_embeddings: true,
        require_cuda: true, trust_remote_code: true, batch_size: 32,
        query_instruction: 'Given a Chinese literary quotation, retrieve the literary theme concepts whose meanings are expressed or strongly implied by the quotation. Match concepts by meaning, including implicit themes, rather than by keyword overlap alone.',
      },
    },
    ranking: { top_k_report: [3, 5], store_full_ranking: true },
    deterministic_match: { enabled: true, method: 'exact_substring', notes: ['Exact substring matching of canonical and alias forms; kept separate from semantic ranking.'] },
    runs_dir: 'research/retrieval/runs', overwrite_completed_runs: false,
    notes: [
      'Development benchmark only: v1.43 was curated from this same quote batch.',
      'Report macro Recall@3, macro Recall@5, and quote-level Success@3; no Recall@10/@20 score reporting.',
    ],
  };
  write(`research/retrieval/config/quotes-batch2-v1.43-qwen-${representation}.retrieval.v1.json`, config);
}

console.log(JSON.stringify({
  library: libraryOut, libraryVersion: outLib.library_version, activeThemes: outLib.counts.themes_active_candidate,
  renamed: ['书籍→文学', '技术→科技', '适应→接受', '经验→经历', '喜悦→幸福'],
  merged: ['孩子→童年'],
  added: additions.map(a => a.name), fixture: fixtureOut, quoteCount: fixture.quotes.length,
}, null, 2));
