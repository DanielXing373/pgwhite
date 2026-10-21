import { performance } from "node:perf_hooks";
import { calculateUsdCost } from "../cost.mjs";
import { BudgetExceededError, redactDeep, redactSecrets } from "../safety.mjs";
import { buildSelectorPrompt } from "./instruction.mjs";
import { parseSelectorResponse, validateSelection } from "./validate.mjs";

function emptyUsage() {
  return {
    input_tokens: null,
    output_tokens: null,
    reasoning_tokens: null,
    cached_tokens: null,
  };
}

export async function selectThemes({
  quote,
  candidates,
  config,
  provider,
  safety,
  pricing,
}) {
  const prompt = buildSelectorPrompt({
    quoteId: quote.quote_id,
    textZh: quote.text_zh,
    candidates,
    includeAliases: config.include_aliases === true,
  });
  const leaked = JSON.stringify({ prompt, candidates });
  if (/expected_theme|gold_label|benchmark evaluation/i.test(leaked)) {
    throw new Error("STOP: selector prompt or candidates contain gold-evaluation fields.");
  }
  const retryLimit = config.execution?.retry_limit ?? 0;
  const started = performance.now();
  const errors = [];
  let retries = 0;
  while (true) {
    try {
      safety.beforeRequest();
    } catch (error) {
      if (error instanceof BudgetExceededError || error.budget) {
        return {
          quote_id: quote.quote_id,
          text_zh: quote.text_zh,
          validation_status: "not_run",
          stop_reason: redactSecrets(error.message),
          selected_theme_ids: null,
          raw_response: null,
          parsed_response: null,
          prompt,
          candidates,
          usage: emptyUsage(),
          cost: {
            status: "unknown",
            usd: null,
            reason: "not_run",
            pricing_source: pricing?.source ?? null,
            pricing_version: pricing?.version ?? null,
          },
          latency_ms: performance.now() - started,
          retries,
          errors,
          provider_id: provider.provider_id,
          model_id: config.model_id,
          local_runtime: null,
        };
      }
      throw error;
    }
    try {
      const response = await provider.complete({
        model: config.model_id,
        prompt,
        candidates,
        timeoutMs: config.execution?.timeout_ms ?? 60000,
        openaiRequest: config.openai_request ?? null,
      });
      const parsed = parseSelectorResponse(response.response_text);
      const validation = parsed.ok
        ? validateSelection(
          parsed.selected_theme_ids,
          candidates.map((candidate) => candidate.id),
          { maxSelected: config.max_selected ?? 3 },
        )
        : { status: "invalid", reason: parsed.reason, selected_theme_ids: null };
      const cost = calculateUsdCost({ usage: response.usage, pricing });
      safety.recordCost(cost.usd);
      return {
        quote_id: quote.quote_id,
        text_zh: quote.text_zh,
        validation_status: validation.status,
        validation_reason: validation.reason,
        invented_theme_ids: validation.invented_theme_ids ?? [],
        selected_theme_ids: validation.selected_theme_ids,
        raw_response: redactDeep(response.raw_response),
        parsed_response: parsed.ok ? { selected_theme_ids: parsed.selected_theme_ids } : null,
        prompt,
        request_body: redactDeep(response.request_body),
        candidates,
        usage: response.usage ?? emptyUsage(),
        cost,
        latency_ms: performance.now() - started,
        retries,
        errors,
        provider_id: response.provider_id,
        model_id: response.model_id,
        local_runtime: response.local_runtime ?? null,
        http_status: response.http_status ?? null,
      };
    } catch (error) {
      errors.push({
        attempt: retries + 1,
        message: redactSecrets(error.message),
        retryable: Boolean(error.retryable),
        status: error.status ?? null,
      });
      if (!error.retryable || retries >= retryLimit) {
        return {
          quote_id: quote.quote_id,
          text_zh: quote.text_zh,
          validation_status: "error",
          validation_reason: "provider_error",
          selected_theme_ids: null,
          raw_response: null,
          parsed_response: null,
          prompt,
          candidates,
          usage: emptyUsage(),
          cost: {
            status: "unknown",
            usd: null,
            reason: "provider_error",
            pricing_source: pricing?.source ?? null,
            pricing_version: pricing?.version ?? null,
          },
          latency_ms: performance.now() - started,
          retries,
          errors,
          provider_id: provider.provider_id,
          model_id: config.model_id,
          local_runtime: null,
        };
      }
      retries += 1;
    }
  }
}
