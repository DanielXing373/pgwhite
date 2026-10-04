/**
 * Cosine similarity and ranking helpers.
 */

export function l2Normalize(vector) {
  const v = Float64Array.from(vector);
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return v;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error(
      `cosineSimilarity length mismatch: ${a?.length} vs ${b?.length}`,
    );
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Rank library items by cosine similarity to a query vector.
 * Tie-break: higher score first, then tag id ascending (deterministic).
 *
 * @returns {Array<{rank:number,tag_id:string,canonical_zh:string,similarity:number}>}
 */
export function rankByCosine(queryVector, libraryItems) {
  const scored = libraryItems.map((item) => ({
    tag_id: item.id,
    canonical_zh: item.canonical_zh,
    similarity: cosineSimilarity(queryVector, item.vector),
  }));

  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    return a.tag_id.localeCompare(b.tag_id);
  });

  return scored.map((row, i) => ({
    rank: i + 1,
    tag_id: row.tag_id,
    canonical_zh: row.canonical_zh,
    similarity: row.similarity,
  }));
}

export function takeTopK(ranked, k) {
  return ranked.slice(0, k);
}
