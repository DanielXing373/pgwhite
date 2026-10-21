const SECRET_PATTERNS = [
  [/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]"],
  [/Bearer\s+\S+/gi, "Bearer [REDACTED]"],
  [/(api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s&,}]+/gi, "$1[REDACTED]"],
  [/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]"],
];

export function redactSecrets(value) {
  let text = String(value ?? "");
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function redactDeep(value) {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (/authorization|api[-_]?key|x-goog-api-key|secret|password/i.test(key)) continue;
      out[key] = redactDeep(child);
    }
    return out;
  }
  return value;
}

export class BudgetExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = "BudgetExceededError";
    this.budget = true;
    this.retryable = false;
  }
}

export class ProviderHttpError extends Error {
  constructor(message, { status = null, retryable = false, provider = null } = {}) {
    super(redactSecrets(message));
    this.name = "ProviderHttpError";
    this.status = status;
    this.retryable = retryable;
    this.provider = provider;
  }
}

export function assertExecutionMode({ executionMode, allowPaidApi, stage, providerId }) {
  if (!["dry-run", "local", "paid-api"].includes(executionMode)) {
    throw new Error(`Unknown execution mode: ${executionMode}`);
  }
  if (executionMode === "dry-run") {
    return { calls_provider: false };
  }
  const paid = new Set(["openai", "deepseek", "gemini"]);
  if (executionMode === "paid-api") {
    if (allowPaidApi !== true) {
      throw new Error("STOP: paid-api requires --allow-paid-api. No request was sent.");
    }
    if (stage !== "selection" || !paid.has(providerId)) {
      throw new Error(
        `STOP: paid-api only runs a selector on openai, deepseek, or gemini. Refusing ${providerId}. No fallback provider will be used.`,
      );
    }
    return { calls_provider: true };
  }
  const localProviders = stage === "retrieval"
    ? new Set(["qwen3", "fake"])
    : new Set(["ollama", "fake"]);
  if (!localProviders.has(providerId)) {
    throw new Error(
      `STOP: local mode cannot run provider ${providerId}. No fallback provider will be used.`,
    );
  }
  return { calls_provider: true };
}

export function collectBlockers(effective, { artifactExists = false, pricingRate = null } = {}) {
  const blockers = [];
  if (effective.stage !== "selection") return blockers;
  if (!effective.model_id) {
    blockers.push("model_id is unset. Pass --model or set PGWHITE_SELECTOR_MODEL.");
  }
  if (!effective.retrieval_artifact_path) {
    blockers.push("retrieval_artifact_path is unset. Pass --retrieval-artifact.");
  } else if (!artifactExists) {
    blockers.push("retrieval artifact file does not exist.");
  }
  const budget = effective.execution?.max_estimated_budget_usd;
  if (budget != null && !pricingRate) {
    blockers.push(
      "max_estimated_budget_usd is set but no pricing rate matches this provider and model. Cost will not be invented.",
    );
  }
  if (effective.execution?.max_requests == null) {
    blockers.push("max_requests is required before a selector calls a model.");
  }
  return blockers;
}

export function createBudgetGuard({
  maxRequests = null,
  maxEstimatedBudgetUsd = null,
} = {}) {
  return {
    requestsStarted: 0,
    knownUsd: 0,
    unknownCostCalls: 0,
    exceeded: false,
    beforeRequest() {
      if (maxRequests != null && this.requestsStarted >= maxRequests) {
        this.exceeded = true;
        throw new BudgetExceededError(
          `STOP: max_requests ${maxRequests} reached. No further request was sent.`,
        );
      }
      if (maxEstimatedBudgetUsd != null && this.knownUsd >= maxEstimatedBudgetUsd) {
        this.exceeded = true;
        throw new BudgetExceededError(
          "STOP: estimated spend reached max_estimated_budget_usd. No further request was sent.",
        );
      }
      if (maxEstimatedBudgetUsd != null && this.unknownCostCalls > 0) {
        this.exceeded = true;
        throw new BudgetExceededError(
          "STOP: a previous call has unknown cost, so the budget cannot be verified. No further request was sent.",
        );
      }
      this.requestsStarted += 1;
    },
    recordCost(usd) {
      if (usd == null || !Number.isFinite(usd)) {
        this.unknownCostCalls += 1;
        return;
      }
      this.knownUsd += usd;
      if (maxEstimatedBudgetUsd != null && this.knownUsd > maxEstimatedBudgetUsd) {
        this.exceeded = true;
      }
    },
  };
}
