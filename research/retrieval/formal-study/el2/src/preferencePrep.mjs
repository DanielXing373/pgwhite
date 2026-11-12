import { shuffleInPlace } from "../../runner/src/humanEval.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | a)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const EL2_SOURCE_IDS = Object.freeze([
  "human-gold",
  "embedding-top2",
  "gpt-6-luna",
  "deepseek-flash",
]);

/**
 * Plan per-quote display order. Does not write a participant pack.
 * Source identities stay in the returned mapping only.
 */
export function planPreferenceDisplayOrder({ quoteIds, seed, sourceIds = EL2_SOURCE_IDS }) {
  if (!Number.isInteger(seed)) {
    throw new Error("STOP: preference seed must be an integer.");
  }
  return quoteIds.map((quoteId, index) => {
    const order = shuffleInPlace([...sourceIds], mulberry32(seed + index + 1));
    return { quote_id: quoteId, display_order: order };
  });
}

export function sampleQuotesForParticipant({ quoteIds, seed, participantIndex, count }) {
  if (count < 10 || count > 20) {
    throw new Error("STOP: each participant should receive 10–20 unique quotations.");
  }
  const shuffled = shuffleInPlace([...quoteIds], mulberry32(seed + 1000 + participantIndex));
  return shuffled.slice(0, count);
}
