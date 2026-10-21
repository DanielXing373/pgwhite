import { ProviderHttpError, redactSecrets } from "../safety.mjs";

export function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function extractOpenAICompatibleUsage(body) {
  const usage = body?.usage;
  if (!usage || typeof usage !== "object") {
    return {
      input_tokens: null,
      output_tokens: null,
      reasoning_tokens: null,
      cached_tokens: null,
    };
  }
  return {
    input_tokens: finiteOrNull(usage.prompt_tokens),
    output_tokens: finiteOrNull(usage.completion_tokens),
    reasoning_tokens: finiteOrNull(
      usage.completion_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens,
    ),
    cached_tokens: finiteOrNull(
      usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens,
    ),
  };
}

export function extractGeminiUsage(body) {
  const usage = body?.usageMetadata;
  if (!usage || typeof usage !== "object") {
    return {
      input_tokens: null,
      output_tokens: null,
      reasoning_tokens: null,
      cached_tokens: null,
    };
  }
  return {
    input_tokens: finiteOrNull(usage.promptTokenCount),
    output_tokens: finiteOrNull(usage.candidatesTokenCount),
    reasoning_tokens: finiteOrNull(usage.thoughtsTokenCount),
    cached_tokens: finiteOrNull(usage.cachedContentTokenCount),
  };
}

export function geminiText(body) {
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part?.text ?? "").join("");
}

export async function postJson({
  url,
  headers,
  body,
  timeoutMs,
  fetchImpl,
  provider,
}) {
  const fetchFn = fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? 60000);
  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { unparsed_text: redactSecrets(text).slice(0, 300) };
    }
    if (!response.ok) {
      const detail = redactSecrets(text).slice(0, 300);
      throw new ProviderHttpError(`${provider} HTTP ${response.status}: ${detail}`, {
        status: response.status,
        retryable: [408, 409, 425, 429, 500, 502, 503, 504].includes(response.status),
        provider,
      });
    }
    return { status: response.status, body: parsed };
  } catch (error) {
    if (error instanceof ProviderHttpError) throw error;
    const aborted = error?.name === "AbortError";
    throw new ProviderHttpError(
      aborted ? `${provider} timeout` : `${provider} request failed`,
      { status: aborted ? 408 : null, retryable: true, provider },
    );
  } finally {
    clearTimeout(timer);
  }
}

export function requireEnv(env, name) {
  const value = env?.[name];
  if (!value) {
    throw new ProviderHttpError(`${name} is not set`, {
      status: null,
      retryable: false,
      provider: name,
    });
  }
  return value;
}
