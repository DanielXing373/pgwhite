/**
 * Deterministic textual evidence layer (NOT embedding retrieval).
 *
 * Method: exact Unicode substring of canonical label or alias within Quote text.
 *
 * Known limitation (documented, not "fixed" with NLP):
 * Very short Chinese surfaces (length < 2), if present as aliases, can match
 * pathologically inside unrelated words. Such hits are flagged
 * `caution_short_surface: true` for later human review.
 *
 * Does not fuzzy-match, embed, LLM-infer, or boost semantic scores.
 */

/**
 * @typedef {object} DeterministicHit
 * @property {string} tag_id
 * @property {string} canonical_zh
 * @property {"canonical"|"alias"} match_type
 * @property {string} matched_surface
 * @property {boolean} caution_short_surface
 */

/**
 * @param {string} quoteText
 * @param {Array<{id:string,canonical_zh:string,aliases:string[]}>} themes
 * @returns {DeterministicHit[]}
 */
export function findDeterministicHits(quoteText, themes) {
  const text = String(quoteText ?? "");
  if (!text) return [];

  /** @type {DeterministicHit[]} */
  const hits = [];
  const seen = new Set(); // tag_id + match_type + surface

  for (const tag of themes) {
    const surfaces = [
      { surface: tag.canonical_zh, match_type: "canonical" },
      ...tag.aliases.map((a) => ({ surface: a, match_type: "alias" })),
    ];

    for (const { surface, match_type } of surfaces) {
      const s = String(surface ?? "").trim();
      if (!s) continue;
      if (!text.includes(s)) continue;
      const key = `${tag.id}|${match_type}|${s}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        tag_id: tag.id,
        canonical_zh: tag.canonical_zh,
        match_type,
        matched_surface: s,
        caution_short_surface: [...s].length < 2,
      });
    }
  }

  // Stable order: by tag_id, then match_type, then surface
  hits.sort((a, b) => {
    if (a.tag_id !== b.tag_id) return a.tag_id.localeCompare(b.tag_id);
    if (a.match_type !== b.match_type) {
      return a.match_type.localeCompare(b.match_type);
    }
    return a.matched_surface.localeCompare(b.matched_surface);
  });

  return hits;
}
