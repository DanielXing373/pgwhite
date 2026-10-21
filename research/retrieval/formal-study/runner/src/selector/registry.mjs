import { createDeepSeekSelector } from "./providers/deepseek.mjs";
import { createFakeSelector } from "./providers/fake.mjs";
import { createGeminiSelector } from "./providers/gemini.mjs";
import { createOllamaSelector } from "./providers/ollama.mjs";
import { createOpenAISelector } from "./providers/openai.mjs";

export function createSelectorProvider(providerId, options = {}) {
  if (providerId === "openai") return createOpenAISelector(options);
  if (providerId === "deepseek") return createDeepSeekSelector(options);
  if (providerId === "gemini") return createGeminiSelector(options);
  if (providerId === "ollama") return createOllamaSelector(options);
  if (providerId === "fake") return createFakeSelector(options);
  throw new Error(
    `Unknown selector provider ${providerId}. No fallback provider will be used.`,
  );
}
