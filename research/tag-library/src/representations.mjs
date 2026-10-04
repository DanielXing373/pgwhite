/**
 * Deterministic text representations for future embedding evaluation (1.42).
 * Related concepts are intentionally excluded from representation C.
 */

export function representationA(canonicalZh) {
  return String(canonicalZh ?? "").trim();
}

export function representationB(canonicalZh, definition) {
  return `${representationA(canonicalZh)}：${String(definition ?? "").trim()}`;
}

export function representationC(canonicalZh, definition, aliases = []) {
  const cleaned = [...new Set(
    (aliases ?? [])
      .map((a) => String(a ?? "").trim())
      .filter((a) => a && a !== representationA(canonicalZh)),
  )].sort();
  const aliasPart = cleaned.length ? cleaned.join("、") : "（无）";
  return `${representationB(canonicalZh, definition)}｜别名：${aliasPart}`;
}

export function buildRepresentations(tag) {
  const zh = tag.canonical_zh ?? tag.zh;
  const definition = tag.definition ?? "";
  const aliases = tag.aliases ?? [];
  return {
    A_label: representationA(zh),
    B_label_definition: representationB(zh, definition),
    C_label_definition_aliases: representationC(zh, definition, aliases),
  };
}
