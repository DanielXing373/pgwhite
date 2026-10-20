/**
 * First-class Qwen3 embedding query-encoding modes for formal reproducibility.
 * Pure helpers — no model I/O. Tests assert exact effective strings.
 */

export const QWEN_INSTRUCTION_MODES = Object.freeze([
  "none",
  "prompt_name=query",
  "task_instruct",
]);

export const DEFAULT_LITERARY_TASK_INSTRUCTION =
  "Given a Chinese literary quotation, retrieve the literary theme concepts whose meanings are expressed or strongly implied by the quotation. Match concepts by meaning, including implicit themes, rather than by keyword overlap alone.";

/** Built-in Sentence-Transformers prompt for Qwen3-Embedding `prompt_name="query"`. */
export const QWEN_BUILTIN_QUERY_PROMPT =
  "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery:";

/**
 * @param {string} mode
 * @param {string} quote
 * @param {{ task_instruction?: string }} [options]
 * @returns {{
 *   instruction_mode: string,
 *   role: "query"|"document",
 *   encode_kwargs: Record<string, unknown>,
 *   effective_query_instruction: string|null,
 *   effective_prompt_prefix: string|null,
 *   effective_query_preview: string,
 *   document_encoding: string,
 *   query_encoding_description: string,
 * }}
 */
export function resolveQwenQueryEncoding(mode, quote, options = {}) {
  const text = String(quote ?? "");
  const task =
    options.task_instruction ?? DEFAULT_LITERARY_TASK_INSTRUCTION;

  if (mode === "none") {
    return {
      instruction_mode: "none",
      role: "query",
      encode_kwargs: {},
      effective_query_instruction: null,
      effective_prompt_prefix: null,
      effective_query_preview: text,
      document_encoding: "model.encode(texts) without prompt",
      query_encoding_description:
        "model.encode(query_text) without prompt (symmetric with documents)",
    };
  }

  if (mode === "prompt_name=query") {
    return {
      instruction_mode: "prompt_name=query",
      role: "query",
      encode_kwargs: { prompt_name: "query" },
      effective_query_instruction:
        "Given a web search query, retrieve relevant passages that answer the query",
      effective_prompt_prefix: QWEN_BUILTIN_QUERY_PROMPT,
      effective_query_preview: `${QWEN_BUILTIN_QUERY_PROMPT}${text}`,
      document_encoding: "model.encode(texts) without prompt",
      query_encoding_description:
        "model.encode(query_text, prompt_name='query')",
    };
  }

  if (mode === "task_instruct") {
    const prefix = `Instruct: ${task}\nQuery:`;
    return {
      instruction_mode: "task_instruct",
      role: "query",
      encode_kwargs: { prompt: prefix },
      effective_query_instruction: task,
      effective_prompt_prefix: prefix,
      effective_query_preview: `${prefix}${text}`,
      document_encoding: "model.encode(texts) without prompt",
      query_encoding_description:
        "model.encode(query_text, prompt='Instruct: <task>\\nQuery:')",
    };
  }

  throw new Error(
    `Unknown instruction_mode ${JSON.stringify(mode)}. Expected one of: ${QWEN_INSTRUCTION_MODES.join(", ")}`,
  );
}

/** Normalize CLI/config aliases to canonical mode ids. */
export function normalizeInstructionMode(raw) {
  if (raw == null || raw === "") return "task_instruct";
  const s = String(raw);
  if (s === "none") return "none";
  if (s === "prompt_name=query" || s === "prompt_name_query" || s === "query") {
    return "prompt_name=query";
  }
  if (s === "task_instruct" || s === "task" || s === "instruct") {
    return "task_instruct";
  }
  throw new Error(`Invalid instruction_mode: ${s}`);
}
