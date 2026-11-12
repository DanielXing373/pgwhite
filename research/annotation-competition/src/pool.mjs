import { DIMENSIONS } from "./library.mjs";
import { seededRandom, sha256Text, shuffled } from "./util.mjs";

export const PACK_SCHEMA = "ac-review-pack.v1";
export const JUDGMENT_SCHEMA = "ac-judgments.v1";

export function assertSameDataset(runs) {
  const first = runs[0].dataset;
  for (const run of runs) {
    if (run.dataset.id !== first.id || run.dataset.sha256 !== first.sha256) {
      throw new Error(`STOP: ${run.run_id} uses dataset ${run.dataset.id}; a pack mixes one dataset only.`);
    }
    if (run.dataset.limit != null) {
      throw new Error(`STOP: ${run.run_id} is a --limit smoke run and cannot enter a review pack.`);
    }
  }
  return first;
}

/** Merge judgment files; a later file overrides an earlier one and conflicts are reported. */
export function mergeJudgments(files) {
  const judgments = {};
  const conflicts = [];
  for (const file of files) {
    for (const [quoteId, tags] of Object.entries(file.judgments ?? {})) {
      judgments[quoteId] ??= {};
      for (const [tagId, verdict] of Object.entries(tags)) {
        if (verdict !== "accept" && verdict !== "reject") continue;
        const previous = judgments[quoteId][tagId];
        if (previous && previous !== verdict) conflicts.push({ quote_id: quoteId, tag_id: tagId, from: previous, to: verdict });
        judgments[quoteId][tagId] = verdict;
      }
    }
  }
  return { judgments, conflicts };
}

/**
 * Pool every arm's tags per quotation and dimension, de-duplicate, shuffle.
 * The public pack carries no arm, model, rank, evidence, or cost: the reviewer cannot tell
 * where a tag came from. Tags already judged are left out so later rounds only add new work.
 */
export function buildReviewPack({ runs, library, seed, judgments = {} }) {
  const dataset = assertSameDataset(runs);
  const random = seededRandom(seed);
  const pooled = new Map();
  const texts = new Map();
  for (const run of runs) {
    for (const row of run.results) {
      texts.set(row.quote_id, row.text_zh);
      if (row.status !== "valid") continue;
      const entry = pooled.get(row.quote_id) ?? new Map();
      pooled.set(row.quote_id, entry);
      for (const dimension of run.dimensions) {
        for (const tag of row.tags[dimension] ?? []) {
          const sources = entry.get(tag.tag_id) ?? [];
          sources.push(run.run_id);
          entry.set(tag.tag_id, sources);
        }
      }
    }
  }
  const items = [];
  const contributions = {};
  let total = 0;
  let alreadyJudged = 0;
  for (const quoteId of [...texts.keys()].sort()) {
    const entry = pooled.get(quoteId) ?? new Map();
    contributions[quoteId] = Object.fromEntries(entry);
    const dimensions = {};
    let open = 0;
    for (const dimension of DIMENSIONS) {
      const tags = [...entry.keys()]
        .map((tagId) => library.byId.get(tagId))
        .filter((tag) => tag.dimension === dimension);
      total += tags.length;
      const pending = tags.filter((tag) => !judgments[quoteId]?.[tag.id]);
      alreadyJudged += tags.length - pending.length;
      open += pending.length;
      dimensions[dimension] = shuffled(pending, random).map((tag) => ({
        tag_id: tag.id,
        label: tag.label,
        definition: tag.definition,
      }));
    }
    if (open > 0) items.push({ quote_id: quoteId, text_zh: texts.get(quoteId), dimensions });
  }
  const ordered = shuffled(items, random);
  const packId = sha256Text(JSON.stringify(ordered)).slice(0, 12);
  return {
    pack: {
      schema_version: PACK_SCHEMA,
      pack_id: packId,
      dataset_id: dataset.id,
      library_version: library.version,
      tags_to_judge: total - alreadyJudged,
      items: ordered,
    },
    privateMapping: {
      pack_id: packId,
      seed,
      runs: runs.map((run) => ({ run_id: run.run_id, arm_id: run.arm_id })),
      pooled_tags: total,
      already_judged: alreadyJudged,
      contributions,
    },
  };
}
