/**
 * Re-export 1.41 representation helpers so retrieval runner uses the same semantics.
 * Related concepts must never enter Representation C.
 * Research IDs and provenance must never enter embedding text.
 */
import {
  representationA,
  representationB,
  representationC,
  buildRepresentations,
} from "../../../tag-library/src/representations.mjs";

export {
  representationA,
  representationB,
  representationC,
  buildRepresentations,
};

export function buildRepresentationText(tag, kind) {
  const k = String(kind || "").toUpperCase();
  if (k === "A") return representationA(tag.canonical_zh);
  if (k === "B") return representationB(tag.canonical_zh, tag.definition);
  if (k === "C") {
    return representationC(tag.canonical_zh, tag.definition, tag.aliases);
  }
  throw new Error(`Unknown representation: ${kind} (expected A|B|C)`);
}

export function buildThemeCorpus(themes, representation) {
  return themes.map((tag) => ({
    id: tag.id,
    canonical_zh: tag.canonical_zh,
    representation,
    text: buildRepresentationText(tag, representation),
  }));
}
