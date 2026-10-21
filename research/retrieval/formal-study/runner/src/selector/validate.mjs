export function parseSelectorResponse(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    return { ok: false, reason: "malformed_json", selected_theme_ids: null };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "malformed_json", selected_theme_ids: null };
  }
  if (!Array.isArray(parsed.selected_theme_ids)) {
    return { ok: false, reason: "missing_selected_theme_ids", selected_theme_ids: null };
  }
  return { ok: true, reason: null, selected_theme_ids: parsed.selected_theme_ids };
}

/**
 * Accept only 0–3 unique IDs from the supplied candidate list.
 * Invalid output is returned as invalid. It is not repaired.
 */
export function validateSelection(ids, candidateIds, { maxSelected = 3 } = {}) {
  if (!Array.isArray(ids)) {
    return { status: "invalid", reason: "not_array", selected_theme_ids: null };
  }
  if (ids.length > maxSelected) {
    return { status: "invalid", reason: "too_many", selected_theme_ids: null };
  }
  if (ids.some((id) => typeof id !== "string" || id.trim() === "")) {
    return { status: "invalid", reason: "malformed_id", selected_theme_ids: null };
  }
  if (new Set(ids).size !== ids.length) {
    return { status: "invalid", reason: "duplicate", selected_theme_ids: null };
  }
  const allowed = new Set(candidateIds);
  const invented = ids.filter((id) => !allowed.has(id));
  if (invented.length > 0) {
    return {
      status: "invalid",
      reason: "id_not_in_candidates",
      invented_theme_ids: invented,
      selected_theme_ids: null,
    };
  }
  return { status: "valid", reason: null, selected_theme_ids: [...ids] };
}
