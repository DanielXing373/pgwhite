import fs from 'node:fs';
import path from 'node:path';
import { buildRepresentations } from '../src/representations.mjs';

const root = process.cwd();
const basePath = 'research/tag-library/data/library/atomic-tag-library.v1.json';
const libraryOut = 'research/tag-library/data/library/atomic-tag-library.v1.42.json';
const representationsOut = 'research/tag-library/data/library/representations.v1.42.json';
const benchmarkIn = 'research/retrieval/benchmark/fixtures/calib-zh-themes.v1.json';
const benchmarkOut = 'research/retrieval/benchmark/fixtures/calib-zh-themes.v1.42.json';
const now = new Date('2026-10-11T12:00:00.000Z').toISOString();
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, value) => fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + '\n', 'utf8');

const lib = read(basePath);
const themes = structuredClone(lib.themes);
const byName = new Map(themes.map(t => [t.canonical_zh, t]));
const removals = new Set([
  '沉默', '幻灭', '时间流逝',
  '干净', '污染', '伦理困境',
  '教育缺失', '食物',
  '流言', '现代性', '秘密社会', '跟随', '竞争',
  '性别', '动物', '土地', '天空', '水', '火', '来世', '神',
  // User marked the complete 感知 category as non-Theme.
  ...themes.filter(t => t.category === '感知').map(t => t.canonical_zh),
  // Merge sources; no backward-compatibility map is generated.
  '命运感', '重复', '重生', '接受', '体谅', '爱', '家庭', '掌控', '丑', '美', '自我', '身份',
]);
const mergeAliases = {
  '时间': ['时间流逝'],
  '命运': ['命运感'],
  '轮回': ['重复', '重生'],
  '适应': ['接受'],
  '怜悯': ['体谅'],
  '倦怠': ['懒惰'],
  '爱情': ['爱'],
  '亲情': ['家庭'],
  '占有': ['掌控'],
  '名声': ['荣誉'],
};
for (const [target, aliases] of Object.entries(mergeAliases)) {
  const t = byName.get(target);
  if (!t) throw new Error(`Missing merge target: ${target}`);
  t.aliases = [...new Set([...(t.aliases || []), ...aliases])];
}
const broadenDefinitions = {
  '命运': '命运、宿命或更大力量如何牵引人生轨迹，也包括人对这种不可控性的感受。',
  '轮回': '循环往复、反复发生与生命周而复始的经验。',
  '适应': '面对变化、限制或处境时的接受、调整与继续生活。',
  '怜悯': '理解、体察或同情他人的处境与苦难。',
  '倦怠': '身心疲乏、懈怠或缺乏行动意愿，也包括长期消耗后的提不起劲。',
  '爱情': '人与人之间的爱与亲密情感，包括浪漫吸引、依恋和情感纠葛。',
  '亲情': '家庭成员之间的情感联结、关怀与牵挂。',
  '占有': '对人、物或局面的掌控、据有与不愿放手。',
  '名声': '一个人或群体被认识、评价与记忆的声誉，也包括荣誉及其代价。',
};
for (const [label, definition] of Object.entries(broadenDefinitions)) byName.get(label).definition = definition;

// Reactivate the existing broad 时间 concept; finer temporal ideas are not separate tags.
const time = byName.get('时间');
if (!time) throw new Error('Missing existing inactive Theme 时间');
time.status = 'active_candidate';
time.category = '存在';
time.parents = ['存在'];
time.definition = '时间本身及人对时间的经验，包括经过、顺序、快慢、逆转与价值。';
time.aliases = [...new Set([...(time.aliases || []), '时间流逝'])];
time.notes = 'Reactivated for v1.42 after human review; broad Theme concept, separate from scene/time metadata.';

const maxSuffix = Math.max(...themes.map(t => Number(t.id.match(/theme-(\d+)/)?.[1] || 0)));
const additions = [
  { canonical_zh: '伦理', label_en: 'Ethics', definition: '关于行为正当性、责任、义务与价值规范的思考。', aliases: ['道德'], related: ['善恶', '公正', '责任'], category: '道德', parents: ['道德'] },
  { canonical_zh: '审美', label_en: 'Aesthetics', definition: '对美、丑、形式及其价值的感受、判断与追求。', aliases: ['美', '丑'], related: ['艺术'], category: '审美', parents: ['审美'] },
  { canonical_zh: '自我身份', label_en: 'Self-Identity', definition: '关于自我认同、身份形成及其变化的经验与思考。', aliases: ['自我', '身份'], related: ['归属', '疏离'], category: '自我', parents: ['自我'] },
  { canonical_zh: '宗教', label_en: 'Religion', definition: '围绕宗教信仰、神圣秩序、仪式与相关价值观的经验和思考。', aliases: ['宗教信仰'], related: ['信仰', '救赎'], category: '宗教', parents: ['宗教'] },
];
for (let i = 0; i < additions.length; i++) {
  const a = additions[i];
  if (byName.has(a.canonical_zh)) throw new Error(`New Theme already exists: ${a.canonical_zh}`);
  const t = {
    id: `theme-${String(maxSuffix + i + 1).padStart(4, '0')}-${a.canonical_zh}`,
    canonical_zh: a.canonical_zh,
    label_en: a.label_en,
    dimension: 'theme',
    definition: a.definition,
    aliases: a.aliases,
    related: a.related,
    parents: a.parents,
    category: a.category,
    provenance: ['manual'],
    source_refs: [],
    status: 'active_candidate',
    notes: 'Added from user review for v1.42; definition is a draft for retrieval evaluation.',
  };
  themes.push(t);
  byName.set(t.canonical_zh, t);
}

// Remove retired canonical records, then clean references to labels absent from v1.42.
let finalThemes = themes.filter(t => !removals.has(t.canonical_zh));
const activeNames = new Set(finalThemes.filter(t => t.status === 'active_candidate').map(t => t.canonical_zh));
const aliasToCanonical = new Map();
for (const [target, aliases] of Object.entries(mergeAliases)) for (const alias of aliases) aliasToCanonical.set(alias, target);
for (const alias of ['美', '丑']) aliasToCanonical.set(alias, '审美');
for (const alias of ['自我', '身份']) aliasToCanonical.set(alias, '自我身份');
for (const t of finalThemes) {
  t.aliases = [...new Set((t.aliases || []).filter(a => !removals.has(a) || aliasToCanonical.get(a) === t.canonical_zh))];
  t.related = [...new Set((t.related || []).map(x => aliasToCanonical.get(x) || x).filter(x => activeNames.has(x) && x !== t.canonical_zh))];
  t.representations = buildRepresentations(t);
}
for (const t of finalThemes) t.representations = buildRepresentations(t);

const categoryCounts = {};
for (const t of finalThemes) categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
const outLib = structuredClone(lib);
outLib.library_version = 'atomic-tag-library.v1.42';
outLib.created_at = now;
outLib.research_only = true;
outLib.production_migration = false;
outLib.dimensions.notes = 'Broad Theme 时间 is active and distinct from scene/time metadata; Device remains a separate tagging dimension.';
outLib.themes = finalThemes;
outLib.counts.themes_total = finalThemes.length;
outLib.counts.themes_active_candidate = finalThemes.filter(t => t.status === 'active_candidate').length;
outLib.counts.themes_excluded_or_other = finalThemes.length - outLib.counts.themes_active_candidate;
outLib.category_distribution_themes = categoryCounts;
outLib.provenance_counts_themes = {};
for (const t of finalThemes) for (const p of t.provenance) outLib.provenance_counts_themes[p] = (outLib.provenance_counts_themes[p] || 0) + 1;
write(libraryOut, outLib);
const reps = {
  schema_version: 'tag-representations.v1',
  library_version: outLib.library_version,
  created_at: now,
  embedding_status: 'not_computed',
  note: 'Review-derived v1.42 representations. Related concepts intentionally excluded from C.',
  formats: {
    A: 'canonical label only',
    B: 'label + definition (中文冒号连接)',
    C: 'label + definition + aliases (related excluded)',
  },
  themes: finalThemes.map(t => ({ id: t.id, canonical_zh: t.canonical_zh, A: t.representations.A_label, B: t.representations.B_label_definition, C: t.representations.C_label_definition_aliases })),
  devices: lib.devices.map(t => ({ id: t.id, canonical_zh: t.canonical_zh, A: t.representations.A_label, B: t.representations.B_label_definition, C: t.representations.C_label_definition_aliases })),
};
write(representationsOut, reps);

// A new draft benchmark aligned to the edited taxonomy; the frozen v1.41 fixture remains untouched.
const bench = read(benchmarkIn);
bench.benchmark_version = 'calib-zh-themes.v1.42-review-draft';
bench.created_at = now;
bench.status = 'review-draft';
bench.notes = [
  'New draft aligned to the user-reviewed atomic-tag-library.v1.42; original frozen v1.41 fixture is unchanged.',
  'Core expected labels reflect the recovered manual review and v1.42 taxonomy choices; user-accepted alternatives are preserved in each quote notes, not all counted as required recall.',
  'Empty expected Themes are valid and skipped by Recall@K; they remain in the fixture for manual no-Theme review.',
  'No backward-compatibility mapping is performed.',
];
const changes = {
  'calib-004': { labels: ['伦理'], note: 'v1.42 review: original 道德 label represented by new broad Theme 伦理.' },
  'calib-005': { labels: ['时间'], note: 'v1.42 review: restore original broad 时间 concept.' },
  'calib-006': { labels: ['恐惧', '时间'], note: 'v1.42 review: retain 恐惧 and restore broad 时间.' },
  'calib-008': { labels: [], zero: true, note: 'v1.42 review: the complete 感知 category was removed from Theme; the user considers animal/nature cues potentially descriptive rather than Theme.' },
  'calib-012': { labels: ['占有', '满足'], note: 'v1.42 review: 掌控 merged into 占有.' },
  'calib-020': { labels: ['爱情'], zero: false, note: 'v1.42 review: user identified 爱情 as the missed existing Theme.' },
  'calib-022': { labels: ['时间'], note: 'v1.42 review: restore broad 时间; death imagery is treated as metaphor in user review.' },
  'calib-023': { labels: ['时间'], note: 'v1.42 review: restore broad 时间 rather than narrower temporal sub-tags.' },
  'calib-024': { labels: ['倦怠'], note: 'v1.42 review: 懒惰 folded into broad 倦怠 per user preference.' },
  'calib-028': { labels: ['死亡', '名声'], note: 'v1.42 review: 荣誉 folded into broad 名声; 尊严 was user-accepted but is not required core GT.' },
};
for (const q of bench.quotes) {
  const c = changes[q.quote_id];
  if (c) {
    q.expected_theme_labels = c.labels;
    q.expected_theme_ids = c.labels.map(label => {
      const t = finalThemes.find(x => x.status === 'active_candidate' && x.canonical_zh === label);
      if (!t) throw new Error(`Benchmark label absent in v1.42: ${label} (${q.quote_id})`);
      return t.id;
    });
    q.ambiguity_flags = (q.ambiguity_flags || []).filter(f => !f.startsWith('taxonomy_gap'));
    if (c.zero) q.ambiguity_flags.push('zero_theme');
    else q.ambiguity_flags = q.ambiguity_flags.filter(f => f !== 'zero_theme');
    q.test_purpose = c.labels.length === 0 ? 'zero_theme' : c.labels.length > 1 ? 'multi_theme' : 'single_theme';
    q.notes = `v1.42 review override; original v1.41 note is preserved in the frozen fixture. ${c.note}`;
  } else {
    for (const id of q.expected_theme_ids || []) if (!finalThemes.some(t => t.id === id && t.status === 'active_candidate')) throw new Error(`Stale expected Theme ID ${id} (${q.quote_id})`);
  }
  // preserve user-accepted alternatives for interpretation of the retrieval results
  const feedback = {
    'calib-007': 'User review: all Top-5 candidates were considered plausible.',
    'calib-009': 'User review: 记忆、遗忘 accepted; remaining three candidates rejected as excess.',
    'calib-010': 'User review: 焦虑、冲动、恐惧 accepted; 怀疑、疯狂 rejected.',
    'calib-016': 'User review: hard to classify; 虚伪 accepted as an alternative.',
    'calib-019': 'User review: 希望 is intended; 绝望 and 满足 may also fit.',
    'calib-025': 'User review: 财富 alone is sufficient; 尊严、人性 are optional.',
    'calib-026': 'User review: 敬畏 and 人性 are plausible; fear/awe boundary is subjective.',
    'calib-029': 'User review: all Top-5 candidates were considered useful and more complete than original tags.',
  }[q.quote_id];
  if (feedback) q.notes += ` ${feedback}`;
}
write(benchmarkOut, bench);

const configs = [
  ['B', 'calib-zh-themes-v1.42-qwen-taskinstr-B.retrieval.v1.json'],
  ['C', 'calib-zh-themes-v1.42-qwen-taskinstr-C.retrieval.v1.json'],
];
for (const [representation, file] of configs) {
  const config = {
    schema_version: 'retrieval-config.v1',
    config_id: `calib-zh-themes-v1.42-qwen-taskinstr-${representation}`,
    research_only: true,
    dimension: 'theme',
    tag_library_path: libraryOut,
    active_status: 'active_candidate',
    benchmark_path: benchmarkOut,
    representation,
    provider: {
      id: 'qwen3',
      options: {
        model: 'Qwen/Qwen3-Embedding-0.6B',
        normalize_embeddings: true,
        require_cuda: true,
        trust_remote_code: true,
        batch_size: 32,
        query_instruction: 'Given a Chinese literary quotation, retrieve the literary theme concepts whose meanings are expressed or strongly implied by the quotation. Match concepts by meaning, including implicit themes, rather than by keyword overlap alone.',
      },
    },
    ranking: { top_k_report: [5, 10, 20], store_full_ranking: true },
    deterministic_match: {
      enabled: true,
      method: 'exact_substring',
      notes: ['Conservative Chinese exact substring of canonical/alias forms.', 'Short surfaces (len < 2) are recorded with caution_short_surface=true; no fuzzy/NLP.'],
    },
    runs_dir: 'research/retrieval/runs',
    overwrite_completed_runs: false,
    notes: [
      'Review-derived v1.42 Theme library and calibration draft.',
      `Representation ${representation}; run B and C separately with immutable run IDs.`,
      'Retrieval candidates only; not a calibrated assignment probability or production auto-tag policy.',
    ],
  };
  write(`research/retrieval/config/${file}`, config);
}
console.log(JSON.stringify({
  library: libraryOut,
  libraryVersion: outLib.library_version,
  themesTotal: finalThemes.length,
  activeThemes: finalThemes.filter(t => t.status === 'active_candidate').length,
  additions: additions.map(t => t.canonical_zh),
  reactivated: time.canonical_zh,
  benchmark: benchmarkOut,
  expectedQuotes: bench.quotes.filter(q => q.expected_theme_ids?.length).length,
  configs: configs.map(x => x[1]),
}, null, 2));
