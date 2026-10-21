export function findPricingRate(catalog, providerId, modelId) {
  const rates = Array.isArray(catalog?.rates) ? catalog.rates : [];
  return rates.find((rate) => rate.provider === providerId && rate.model_id === modelId) ?? null;
}

function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * USD from provider-reported tokens and an explicit catalog rate.
 * Missing tokens or missing prices stay unknown. Nothing is imputed.
 */
export function calculateUsdCost({ usage, pricing }) {
  const pricingSource = pricing?.source ?? null;
  const pricingVersion = pricing?.version ?? null;
  const inputTokens = finiteOrNull(usage?.input_tokens);
  const outputTokens = finiteOrNull(usage?.output_tokens);
  if (inputTokens == null || outputTokens == null) {
    return {
      status: "unknown",
      usd: null,
      currency: "USD",
      reason: "token_usage_unavailable",
      pricing_source: pricingSource,
      pricing_version: pricingVersion,
    };
  }
  const inputRate = finiteOrNull(pricing?.input_usd_per_million);
  const outputRate = finiteOrNull(pricing?.output_usd_per_million);
  if (inputRate == null || outputRate == null) {
    return {
      status: "unknown",
      usd: null,
      currency: "USD",
      reason: "pricing_unavailable",
      pricing_source: pricingSource,
      pricing_version: pricingVersion,
    };
  }

  const reasoningTokens = finiteOrNull(usage?.reasoning_tokens);
  const cachedTokens = finiteOrNull(usage?.cached_tokens);
  if (reasoningTokens != null && reasoningTokens > 0 && finiteOrNull(pricing?.reasoning_usd_per_million) == null) {
    return {
      status: "unknown",
      usd: null,
      currency: "USD",
      reason: "reasoning_pricing_unavailable",
      pricing_source: pricingSource,
      pricing_version: pricingVersion,
    };
  }
  if (cachedTokens != null && cachedTokens > 0 && finiteOrNull(pricing?.cached_input_usd_per_million) == null) {
    return {
      status: "unknown",
      usd: null,
      currency: "USD",
      reason: "cached_pricing_unavailable",
      pricing_source: pricingSource,
      pricing_version: pricingVersion,
    };
  }
  if (cachedTokens != null && cachedTokens > inputTokens) {
    return {
      status: "unknown",
      usd: null,
      currency: "USD",
      reason: "cached_tokens_exceed_input_tokens",
      pricing_source: pricingSource,
      pricing_version: pricingVersion,
    };
  }

  const billableInput = inputTokens - (cachedTokens ?? 0);
  const inputUsd = (billableInput * inputRate) / 1e6;
  const cachedUsd = ((cachedTokens ?? 0) * (pricing?.cached_input_usd_per_million ?? 0)) / 1e6;
  const outputUsd = (outputTokens * outputRate) / 1e6;
  const reasoningUsd = ((reasoningTokens ?? 0) * (pricing?.reasoning_usd_per_million ?? 0)) / 1e6;
  const usd = inputUsd + cachedUsd + outputUsd + reasoningUsd;
  return {
    status: "calculated",
    usd,
    currency: "USD",
    reason: null,
    pricing_source: pricingSource,
    pricing_version: pricingVersion,
    components: {
      input_usd: inputUsd,
      cached_input_usd: cachedUsd,
      output_usd: outputUsd,
      reasoning_usd: reasoningUsd,
    },
  };
}

export function summarizeCosts(rows) {
  const priced = rows.filter((row) => row.cost?.status === "calculated" && Number.isFinite(row.cost.usd));
  const attempted = rows.filter((row) => row.validation_status !== "not_run");
  const unknown = attempted.length - priced.length;
  const partial = priced.reduce((sum, row) => sum + row.cost.usd, 0);
  const complete = unknown === 0 && attempted.length > 0;
  return {
    attempted_quotes: attempted.length,
    priced_quotes: priced.length,
    unpriced_quotes: unknown,
    total_usd: complete ? partial : null,
    total_usd_status: complete ? "calculated" : "unknown",
    partial_priced_usd: partial,
    average_usd_per_quote: complete ? partial / attempted.length : null,
    projected_usd_per_1000_quotes: complete ? (partial / attempted.length) * 1000 : null,
    projection_note:
      "Cost projection uses the sequential per-quote mean. It is not a concurrent throughput measurement. Unknown token or price rows keep the total unknown.",
  };
}
