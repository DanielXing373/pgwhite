const DEFAULT_MODEL = "qwen3.5:4b";
const DEFAULT_URL = "http://127.0.0.1:11434/api/chat";

const SYSTEM_PROMPT = [
  "你负责分析一条中文文学引文，提出可用于主题检索的短概念。",
  "只给出原文直接支持或强烈暗示的概念；不要补充作品背景，不要写分析过程。",
  "概念必须是短语，不得创建或改写标签库标签。证据不足时允许返回空数组。",
  '严格返回 JSON：{"concepts":["概念一","概念二"]}。最多 5 个概念。',
].join("\n");

export function createOllamaConceptProvider(options = {}) {
  const model = options.model ?? process.env.PGWHITE_OLLAMA_MODEL ?? DEFAULT_MODEL;
  const url = options.url ?? process.env.PGWHITE_OLLAMA_URL ?? DEFAULT_URL;
  const timeoutMs = options.timeout_ms ?? 180_000;

  return {
    getMetadata() {
      return {
        provider_id: "ollama-local-chat",
        model_name: model,
        endpoint: url,
        device: "local Ollama runtime",
      };
    },
    async generateConcepts(quote) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: quote },
          ],
          // Qwen3.5 defaults to reasoning mode; disable it for short,
          // machine-readable extraction. This is a top-level Ollama field.
          think: false,
          format: "json",
          stream: false,
          options: {
            temperature: options.temperature ?? 0,
            num_ctx: options.num_ctx ?? 4096,
            num_predict: options.num_predict ?? 192,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          `Ollama request failed (${response.status}): ${JSON.stringify(payload)}`,
        );
      }
      const content = payload?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Ollama response is missing message.content");
      }
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        throw new Error(`Ollama did not return valid JSON: ${content}`, {
          cause: error,
        });
      }
      const raw = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
      return [...new Set(raw
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean))].slice(0, 5);
    },
  };
}
