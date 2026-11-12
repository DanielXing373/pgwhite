#!/usr/bin/env node
// 从冻结的 v1.43 本体（只读）生成竞赛用标签库 tag-library.ac1.json。
// 主题 185 个原样沿用；31 个 device 清理并拆成 修辞(rhetoric) 15 + 描写手法(technique) 9。
// 不修改冻结文件，不写生产库。
import { AC_LIBRARY, FROZEN_ONTOLOGY, FROZEN_ONTOLOGY_SHA256, fromRepo } from "../src/paths.mjs";
import { readJson, sha256File, writeJson } from "../src/util.mjs";

const RHETORIC = [
  "比喻", "拟人", "夸张", "排比", "对比", "反讽", "反问", "设问",
  "借代", "双关", "通感", "象征", "重复", "引用", "拟声",
];
const TECHNIQUE = [
  "外貌描写", "语言描写", "动作描写", "心理描写", "环境描写",
  "细节描写", "白描", "侧面描写", "留白",
];

// 人工确认（2026-11-12）的清理决定。
const MERGED = {
  隐喻: { into: "比喻", reason: "明喻/暗喻/隐喻统一为比喻" },
  对比描写: { into: "对比", reason: "与对比同义" },
  通篇象征: { into: "象征", reason: "单条摘抄无法判断“通篇”" },
};
const REMOVED = {
  头韵: "中文不适用，历史使用 0 次",
  内涵: "几乎所有文学句子都有，无法给出原文证据",
  暗示: "同上，无法给出原文证据",
  意象: "万能标签，人工确认删除",
  长句描写: "句法特征，人工确认删除",
};
// 新增或改写的定义/别名；其余沿用冻结库。
const OVERRIDES = {
  比喻: {
    definition: "用相似的另一事物来写本体，包括明喻、暗喻（隐喻）和借喻。",
    aliases: ["明喻", "暗喻", "隐喻", "借喻"],
    label_en: "Simile/Metaphor",
  },
  对比: { aliases: ["对照", "对比描写"] },
  象征: { aliases: ["通篇象征"] },
  重复: { aliases: ["反复"] },
  引用: { aliases: ["用典"] },
  // 冻结库里设问的别名写成了“反问”，与独立标签反问冲突。
  设问: { aliases: ["自问自答"] },
  // 冻结库定义里带内部备注，不适合给模型和评审看。
  环境描写: { definition: "对自然或社会环境、景物与氛围的刻画。" },
};
const ADDED = {
  语言描写: {
    label_en: "Speech Description",
    definition: "通过人物的对话、独白或说话方式来刻画人物。",
    aliases: ["对话描写"],
    reason: "人物描写五种中原库缺失，人工确认新增",
  },
};

const sourcePath = fromRepo(FROZEN_ONTOLOGY);
const sourceSha = sha256File(sourcePath);
if (sourceSha !== FROZEN_ONTOLOGY_SHA256) {
  throw new Error(`STOP: frozen ontology hash mismatch (${sourceSha}). Library not built.`);
}
const source = readJson(sourcePath);
const sourceDevices = new Map(source.devices.map((device) => [device.canonical_zh, device]));

const accounted = new Set([...RHETORIC, ...TECHNIQUE, ...Object.keys(MERGED), ...Object.keys(REMOVED)]);
const unaccounted = [...sourceDevices.keys()].filter((label) => !accounted.has(label));
if (unaccounted.length > 0) {
  throw new Error(`STOP: frozen devices without a cleanup decision: ${unaccounted.join("、")}`);
}

const themes = source.themes
  .filter((theme) => theme.status === "active_candidate")
  .map((theme, index) => ({
    code: `T${String(index + 1).padStart(3, "0")}`,
    id: theme.id,
    dimension: "theme",
    label: theme.canonical_zh,
    label_en: theme.label_en ?? null,
    definition: theme.definition,
    aliases: theme.aliases ?? [],
    source_id: theme.id,
  }));

function buildDevices(labels, dimension, prefix) {
  return labels.map((label, index) => {
    const base = sourceDevices.get(label);
    const added = ADDED[label];
    if (!base && !added) throw new Error(`STOP: ${label} is neither in the frozen library nor in ADDED`);
    const override = OVERRIDES[label] ?? {};
    const number = String(index + 1).padStart(2, "0");
    return {
      code: `${prefix}${number}`,
      id: `${dimension}-${number}-${label}`,
      dimension,
      label,
      label_en: override.label_en ?? base?.label_en ?? added?.label_en ?? null,
      definition: override.definition ?? base?.definition ?? added.definition,
      aliases: override.aliases ?? base?.aliases ?? added?.aliases ?? [],
      source_id: base?.id ?? null,
    };
  });
}

const library = {
  schema_version: "ac-tag-library.v1",
  library_version: "ac1",
  research_only: true,
  production_migration: false,
  source: { path: FROZEN_ONTOLOGY, sha256: sourceSha, library_version: source.library_version },
  counts: { theme: themes.length, rhetoric: RHETORIC.length, technique: TECHNIQUE.length },
  dimensions: {
    theme: themes,
    rhetoric: buildDevices(RHETORIC, "rhetoric", "R"),
    technique: buildDevices(TECHNIQUE, "technique", "D"),
  },
  cleanup: {
    decided_at: "2026-11-12",
    merged: Object.entries(MERGED).map(([from, value]) => ({ from, ...value })),
    removed: Object.entries(REMOVED).map(([label, reason]) => ({ label, reason })),
    added: Object.entries(ADDED).map(([label, value]) => ({ label, reason: value.reason })),
    note: "生产库中“隐喻→比喻”等迁移不在本研究范围内，上线前另行处理。",
  },
};

writeJson(fromRepo(AC_LIBRARY), library);
console.log(`wrote ${AC_LIBRARY}: theme ${themes.length} / rhetoric ${RHETORIC.length} / technique ${TECHNIQUE.length}`);
