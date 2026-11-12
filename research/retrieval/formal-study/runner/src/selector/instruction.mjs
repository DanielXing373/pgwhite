export const SELECTOR_TASK_INSTRUCTION =
  "Select the existing literary Theme concepts whose meanings are expressed or strongly implied by the quotation. Choose only from the supplied candidate IDs. Return at most 3 IDs. Return an empty list when none of the candidates fit. Do not invent Themes. Do not select a Theme only because a keyword or setting appears.";

export const SELECTOR_TASK_INSTRUCTION_EL2 =
  "Select the existing literary Theme concepts whose meanings are expressed or strongly implied by the quotation. Choose only from the supplied candidate IDs. Return at most 2 Theme IDs. Returning zero Themes is valid. Do not invent Themes. Prioritize the most central and textually justified Themes. Do not select a Theme merely because it is loosely related to the quotation. Do not fill the available slots unnecessarily. If no candidate Theme is sufficiently supported, return an empty list. When you select two Themes, order them from most to least important, with the most representative Theme first. Do not select a Theme only because a keyword or setting appears.";

export const EL2_PROMPT_VERSION = "selector-task-instruction.el2.v1";

export function selectionResponseSchema(candidateIds, { maxItems = 3 } = {}) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["selected_theme_ids"],
    properties: {
      selected_theme_ids: {
        type: "array",
        maxItems,
        items: {
          type: "string",
          enum: [...candidateIds],
        },
      },
    },
  };
}

export function buildSelectorPrompt({
  quoteId,
  textZh,
  candidates,
  includeAliases = false,
  maxSelected = 3,
  taskInstruction = SELECTOR_TASK_INSTRUCTION,
} = {}) {
  const blocks = candidates.map((candidate) => {
    const lines = [
      `- id: ${candidate.id}`,
      `  label: ${candidate.canonical_zh}`,
      `  definition: ${candidate.definition}`,
    ];
    if (includeAliases) {
      const aliases = (candidate.aliases ?? []).filter(Boolean).join("、") || "（无）";
      lines.push(`  aliases: ${aliases}`);
    }
    return lines.join("\n");
  });
  const orderNote = maxSelected === 2
    ? 'Return JSON: {"selected_theme_ids":[]} with IDs ordered most to least important.'
    : 'Return JSON: {"selected_theme_ids":[]}';
  const userText = [
    `Quote ID: ${quoteId}`,
    "Quote:",
    textZh,
    "",
    "Candidates:",
    blocks.join("\n"),
    "",
    orderNote,
  ].join("\n");
  return {
    task_instruction: taskInstruction,
    user_text: userText,
  };
}

export function buildOpenAIBody({
  model,
  prompt,
  candidateIds,
  temperature = 0,
  omitTemperature = false,
  reasoningEffort = null,
  maxSelected = 3,
}) {
  const body = {
    model,
    messages: [
      { role: "system", content: prompt.task_instruction },
      { role: "user", content: prompt.user_text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "theme_selection",
        strict: true,
        schema: selectionResponseSchema(candidateIds, { maxItems: maxSelected }),
      },
    },
  };
  if (!omitTemperature && temperature != null) {
    body.temperature = temperature;
  }
  if (reasoningEffort != null && reasoningEffort !== "") {
    body.reasoning_effort = reasoningEffort;
  }
  return body;
}

export const DEEPSEEK_THINKING_DISABLED = { type: "disabled" };

/**
 * Chat Completions json_object only. Theme-ID enum is enforced locally, not by the API.
 * Thinking is disabled by default so temperature is honored and cost stays comparable.
 */
export function buildDeepSeekBody({ model, prompt, candidateIds, deepseekRequest = null }) {
  if (!Array.isArray(candidateIds)) {
    throw new Error("DeepSeek selector requires the candidate ID list");
  }
  const req = deepseekRequest && typeof deepseekRequest === "object" ? deepseekRequest : {};
  const thinkingType = req.thinking?.type ?? DEEPSEEK_THINKING_DISABLED.type;
  return {
    model,
    temperature: req.temperature ?? 0,
    max_tokens: req.max_tokens ?? 512,
    messages: [
      { role: "system", content: prompt.task_instruction },
      { role: "user", content: prompt.user_text },
    ],
    response_format: { type: "json_object" },
    thinking: { type: thinkingType },
    reasoning_effort: req.reasoning_effort ?? "none",
  };
}

export function buildGeminiBody({ prompt, candidateIds, maxSelected = 3 }) {
  return {
    systemInstruction: { parts: [{ text: prompt.task_instruction }] },
    contents: [{ role: "user", parts: [{ text: prompt.user_text }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: selectionResponseSchema(candidateIds, { maxItems: maxSelected }),
    },
  };
}

export function buildOllamaBody({ model, prompt, candidateIds, maxSelected = 3 }) {
  return {
    model,
    stream: false,
    messages: [
      { role: "system", content: prompt.task_instruction },
      { role: "user", content: prompt.user_text },
    ],
    format: selectionResponseSchema(candidateIds, { maxItems: maxSelected }),
    options: { temperature: 0 },
  };
}
