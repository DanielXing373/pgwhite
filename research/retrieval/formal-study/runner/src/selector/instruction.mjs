export const SELECTOR_TASK_INSTRUCTION =
  "Select the existing literary Theme concepts whose meanings are expressed or strongly implied by the quotation. Choose only from the supplied candidate IDs. Return at most 3 IDs. Return an empty list when none of the candidates fit. Do not invent Themes. Do not select a Theme only because a keyword or setting appears.";

export function selectionResponseSchema(candidateIds) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["selected_theme_ids"],
    properties: {
      selected_theme_ids: {
        type: "array",
        maxItems: 3,
        items: {
          type: "string",
          enum: [...candidateIds],
        },
      },
    },
  };
}

export function buildSelectorPrompt({ quoteId, textZh, candidates, includeAliases = false }) {
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
  const userText = [
    `Quote ID: ${quoteId}`,
    "Quote:",
    textZh,
    "",
    "Candidates:",
    blocks.join("\n"),
    "",
    'Return JSON: {"selected_theme_ids":[]}',
  ].join("\n");
  return {
    task_instruction: SELECTOR_TASK_INSTRUCTION,
    user_text: userText,
  };
}

export function buildOpenAIBody({ model, prompt, candidateIds }) {
  return {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: prompt.task_instruction },
      { role: "user", content: prompt.user_text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "theme_selection",
        strict: true,
        schema: selectionResponseSchema(candidateIds),
      },
    },
  };
}

export function buildDeepSeekBody({ model, prompt, candidateIds }) {
  if (!Array.isArray(candidateIds)) {
    throw new Error("DeepSeek selector requires the candidate ID list");
  }
  return {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: prompt.task_instruction },
      { role: "user", content: prompt.user_text },
    ],
    response_format: { type: "json_object" },
  };
}

export function buildGeminiBody({ prompt, candidateIds }) {
  return {
    systemInstruction: { parts: [{ text: prompt.task_instruction }] },
    contents: [{ role: "user", parts: [{ text: prompt.user_text }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: selectionResponseSchema(candidateIds),
    },
  };
}

export function buildOllamaBody({ model, prompt, candidateIds }) {
  return {
    model,
    stream: false,
    messages: [
      { role: "system", content: prompt.task_instruction },
      { role: "user", content: prompt.user_text },
    ],
    format: selectionResponseSchema(candidateIds),
    options: { temperature: 0 },
  };
}
