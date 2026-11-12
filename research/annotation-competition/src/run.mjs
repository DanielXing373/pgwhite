import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import {
  calculateUsdCost,
  findPricingRate,
} from "../../retrieval/formal-study/runner/src/cost.mjs";
import {
  BudgetExceededError,
  createBudgetGuard,
  redactDeep,
  redactSecrets,
} from "../../retrieval/formal-study/runner/src/safety.mjs";
import { loadDataset, loadThemeCandidates } from "./datasets.mjs";
import { DIMENSIONS, loadLibrary } from "./library.mjs";
import { parseAnnotationResponse } from "./parse.mjs";
import { AC_ROOT, PRICING_CATALOG, REPO_ROOT, fromRepo } from "./paths.mjs";
import {
  PROMPT_VERSION,
  assertKnownDimensions,
  buildResponseSchema,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompt.mjs";
import { PAID_PROVIDERS, createProvider } from "./providers.mjs";
import { readJson, sha256Text, writeJson } from "./util.mjs";

export const RUN_SCHEMA = "ac-run.v1";
export const DEFAULT_CNY_PER_USD = 7.2;
const PROVIDER_KEY_ENV = { openai: "OPENAI_API_KEY", deepseek: "DEEPSEEK_API_KEY" };

export function validateConfig(config) {
  const problems = [];
  if (!config.arm_id) problems.push("arm_id is required");
  if (!config.provider?.id || !config.provider?.model_id) problems.push("provider.id and provider.model_id are required");
  if (!config.dataset?.id) problems.push("dataset.id is required");
  if (!Array.isArray(config.dimensions) || config.dimensions.length === 0) problems.push("dimensions must be a non-empty array");
  if (!["full", "top20"].includes(config.theme_scope)) problems.push('theme_scope must be "full" or "top20"');
  if (!["joint", "separate"].includes(config.call_mode)) problems.push('call_mode must be "joint" or "separate"');
  if (!Number.isInteger(config.batch_size) || config.batch_size < 1) problems.push("batch_size must be a positive integer");
  if (typeof config.evidence !== "boolean") problems.push("evidence must be true or false");
  if (!Number.isInteger(config.execution?.max_requests)) problems.push("execution.max_requests is required (hard pre-call cap)");
  if (problems.length > 0) throw new Error(`STOP: invalid arm config: ${problems.join("; ")}`);
  assertKnownDimensions(config.dimensions);
  if (config.theme_scope === "top20" && config.dataset.id !== "dev58") {
    throw new Error("STOP: theme_scope top20 only has frozen retrieval candidates for dev58.");
  }
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function gitInfo() {
  try {
    const run = (args) => execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { commit: run(["rev-parse", "HEAD"]), branch: run(["rev-parse", "--abbrev-ref", "HEAD"]) };
  } catch {
    return { commit: null, branch: null };
  }
}

/** Every request this arm would send, in order. Pure: no provider, no I/O beyond inputs. */
export function planRequests({ config, library, dataset, candidatesByQuote }) {
  const units = config.call_mode === "joint"
    ? [config.dimensions]
    : config.dimensions.map((dimension) => [dimension]);
  const unitPrompts = units.map((dimensions) => ({
    dimensions,
    system: buildSystemPrompt({
      library,
      dimensions,
      evidence: config.evidence,
      themeScope: config.theme_scope,
    }),
    schema: buildResponseSchema({ library, dimensions, evidence: config.evidence }),
  }));
  const requests = [];
  chunk(dataset.quotes, config.batch_size).forEach((quotes, batchIndex) => {
    for (const unit of unitPrompts) {
      requests.push({
        batch_index: batchIndex,
        dimensions: unit.dimensions,
        quotes,
        system: unit.system,
        schema: unit.schema,
        user: buildUserPrompt({
          library,
          quotes,
          dimensions: unit.dimensions,
          themeScope: config.theme_scope,
          candidatesByQuote,
        }),
      });
    }
  });
  return { unitPrompts, requests };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function loop() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, loop));
  return results;
}

function mergeQuoteResults(dataset, config, perRequest) {
  const merged = new Map(dataset.quotes.map((quote) => [quote.quote_id, {
    quote_id: quote.quote_id,
    text_zh: quote.text_zh,
    status: "valid",
    reason: null,
    tags: Object.fromEntries(config.dimensions.map((dimension) => [dimension, []])),
    dropped: [],
  }]));
  for (const { request, parsed, failure } of perRequest) {
    for (const quote of request.quotes) {
      const target = merged.get(quote.quote_id);
      if (failure) {
        target.status = failure.status;
        target.reason = failure.reason;
        continue;
      }
      const row = parsed.find((entry) => entry.quote_id === quote.quote_id);
      if (row.status !== "valid") {
        if (target.status === "valid") {
          target.status = "invalid";
          target.reason = row.reason;
        }
        continue;
      }
      for (const dimension of request.dimensions) target.tags[dimension] = row.tags[dimension];
      target.dropped.push(...row.dropped);
    }
  }
  for (const row of merged.values()) {
    if (row.status !== "valid") row.tags = null;
  }
  return [...merged.values()];
}

export function summarize({ config, results, requestRows, wallClockMs, cnyPerUsd }) {
  const valid = results.filter((row) => row.status === "valid");
  const attempted = results.filter((row) => row.status !== "not_run");
  const tagsPerQuote = {};
  for (const dimension of config.dimensions) {
    const total = valid.reduce((sum, row) => sum + row.tags[dimension].length, 0);
    tagsPerQuote[dimension] = valid.length ? total / valid.length : null;
  }
  const dropped = {};
  for (const row of valid) {
    for (const item of row.dropped) dropped[item.reason] = (dropped[item.reason] ?? 0) + 1;
  }
  const sent = requestRows.filter((row) => row.sent);
  const sum = (key) => sent.reduce((total, row) => total + (row.usage?.[key] ?? 0), 0);
  const allPriced = sent.length > 0 && sent.every((row) => row.cost?.status === "calculated");
  const totalUsd = allPriced ? sent.reduce((total, row) => total + row.cost.usd, 0) : null;
  const usdPerQuote = totalUsd != null && attempted.length ? totalUsd / attempted.length : null;
  return {
    quotes: results.length,
    attempted_quotes: attempted.length,
    valid_quotes: valid.length,
    invalid_quotes: attempted.length - valid.length,
    not_run_quotes: results.length - attempted.length,
    mean_tags_per_valid_quote: tagsPerQuote,
    dropped_tags_by_reason: dropped,
    requests_sent: sent.length,
    tokens: {
      input: sum("input_tokens"),
      cached_input: sum("cached_tokens"),
      output: sum("output_tokens"),
    },
    cost: {
      estimate_kind: "catalog_token_estimate",
      total_usd: totalUsd,
      usd_per_10k_quotes: usdPerQuote == null ? null : usdPerQuote * 10000,
      cny_per_usd: cnyPerUsd,
      cny_per_10k_quotes: usdPerQuote == null ? null : usdPerQuote * 10000 * cnyPerUsd,
    },
    speed: {
      concurrency: config.execution.concurrency ?? 1,
      wall_clock_ms: wallClockMs,
      mean_request_latency_ms: sent.length
        ? sent.reduce((total, row) => total + row.latency_ms, 0) / sent.length
        : null,
      projected_seconds_per_10k_quotes: attempted.length
        ? (wallClockMs / 1000 / attempted.length) * 10000
        : null,
      projection_note: "按本次并发数的实测墙钟时间线性外推，不含导入和网络排队。",
    },
  };
}

/**
 * Run one competition arm.
 * executionMode: "dry-run" (plan only, nothing sent or written), "fake" (offline provider),
 * "paid-api" (real provider; needs allowPaidApi).
 */
export async function runArm({
  config,
  executionMode,
  allowPaidApi = false,
  runId,
  limit = null,
  runsDir = path.join(AC_ROOT, "runs"),
  provider = null,
  env = process.env,
  fetchImpl,
  libraryFile,
}) {
  validateConfig(config);
  if (!["dry-run", "fake", "paid-api"].includes(executionMode)) {
    throw new Error(`STOP: unknown execution mode ${executionMode}`);
  }
  if (executionMode === "paid-api") {
    if (allowPaidApi !== true) throw new Error("STOP: paid-api requires --allow-paid-api. No request was sent.");
    if (!PAID_PROVIDERS.has(config.provider.id)) {
      throw new Error(`STOP: paid-api refuses provider ${config.provider.id}. No fallback provider will be used.`);
    }
  }
  if (executionMode === "paid-api" && !provider) {
    const keyName = PROVIDER_KEY_ENV[config.provider.id];
    if (!env[keyName]) {
      throw new Error(`STOP: ${keyName} is not set (shell or repo-root .env). No request was sent and nothing was written.`);
    }
  }
  const library = loadLibrary(libraryFile);
  const fullDataset = loadDataset(config.dataset);
  const dataset = limit ? { ...fullDataset, quotes: fullDataset.quotes.slice(0, limit) } : fullDataset;
  const candidatesByQuote = config.theme_scope === "top20" && config.dimensions.includes("theme")
    ? loadThemeCandidates(library, { k: 20 })
    : null;
  const { unitPrompts, requests } = planRequests({ config, library, dataset, candidatesByQuote });
  const leaked = JSON.stringify(requests.map((request) => [request.system, request.user]));
  if (/expected_theme|gold_label|human-gold/i.test(leaked)) {
    throw new Error("STOP: a prompt contains gold-evaluation fields.");
  }
  const plan = {
    arm_id: config.arm_id,
    execution_mode: executionMode,
    quotes: dataset.quotes.length,
    requests: requests.length,
    max_requests: config.execution.max_requests,
    system_prompt_chars: unitPrompts.map((unit) => unit.system.length),
    mean_user_prompt_chars: requests.reduce((total, request) => total + request.user.length, 0) / requests.length,
  };
  if (requests.length > config.execution.max_requests) {
    throw new Error(`STOP: plan needs ${requests.length} requests but max_requests is ${config.execution.max_requests}. No request was sent.`);
  }
  if (executionMode === "dry-run") {
    return { plan, preview: { system: requests[0].system, user: requests[0].user }, run: null, runDir: null };
  }

  if (!runId) throw new Error("STOP: --run-id is required when a provider is called.");
  const runDir = path.join(runsDir, runId);
  if (fs.existsSync(runDir)) throw new Error(`STOP: run directory already exists (${runId}). Runs are immutable; use a new --run-id.`);

  const providerId = executionMode === "fake" ? "fake" : config.provider.id;
  const client = provider ?? createProvider(providerId, { env, fetchImpl });
  const catalog = readJson(fromRepo(PRICING_CATALOG));
  const rate = findPricingRate(catalog, config.provider.id, config.provider.model_id);
  const pricing = executionMode === "paid-api" && rate
    ? { ...rate, source: catalog.source, version: catalog.catalog_version }
    : null;
  if (executionMode === "paid-api" && config.execution.max_estimated_budget_usd != null && !pricing) {
    throw new Error("STOP: budget is set but no pricing rate matches this provider/model. Cost will not be invented.");
  }
  const guard = createBudgetGuard({
    maxRequests: config.execution.max_requests,
    maxEstimatedBudgetUsd: executionMode === "paid-api" ? config.execution.max_estimated_budget_usd ?? null : null,
  });
  const retryLimit = config.execution.retry_limit ?? 0;
  const started = performance.now();

  const perRequest = await runPool(requests, config.execution.concurrency ?? 1, async (request) => {
    const row = {
      batch_index: request.batch_index,
      dimensions: request.dimensions,
      quote_ids: request.quotes.map((quote) => quote.quote_id),
      sent: false,
      latency_ms: null,
      usage: null,
      cost: null,
      http_status: null,
      retries: 0,
      errors: [],
      response_text: null,
    };
    while (true) {
      try {
        guard.beforeRequest();
      } catch (error) {
        if (!(error instanceof BudgetExceededError)) throw error;
        row.errors.push({ message: redactSecrets(error.message) });
        return { request, row, parsed: null, failure: { status: "not_run", reason: "budget_stop" } };
      }
      const requestStarted = performance.now();
      try {
        const response = await client.complete({
          model: config.provider.model_id,
          system: request.system,
          user: request.user,
          schema: request.schema,
          timeoutMs: config.execution.timeout_ms ?? 120000,
          request: config.provider.request ?? {},
          quoteCount: request.quotes.length,
          context: {
            quotes: request.quotes,
            dimensions: request.dimensions,
            evidence: config.evidence,
            themeScope: config.theme_scope,
            candidatesByQuote,
            library,
          },
        });
        row.sent = true;
        row.latency_ms = performance.now() - requestStarted;
        row.usage = response.usage;
        row.cost = pricing ? calculateUsdCost({ usage: response.usage, pricing }) : { status: "unpriced", usd: null };
        if (executionMode === "paid-api") guard.recordCost(row.cost.usd);
        row.http_status = response.http_status;
        row.model_id = response.model_id;
        row.response_text = response.response_text;
        row.system_fingerprint = response.raw_response?.system_fingerprint ?? null;
        const parsed = parseAnnotationResponse(response.response_text, {
          quotes: request.quotes,
          library,
          dimensions: request.dimensions,
          evidence: config.evidence,
          themeScope: config.theme_scope,
          candidatesByQuote,
        });
        return { request, row, parsed, failure: null };
      } catch (error) {
        row.errors.push({
          attempt: row.retries + 1,
          message: redactSecrets(error.message),
          status: error.status ?? null,
          retryable: Boolean(error.retryable),
        });
        if (!error.retryable || row.retries >= retryLimit) {
          return { request, row, parsed: null, failure: { status: "error", reason: "provider_error" } };
        }
        row.retries += 1;
      }
    }
  });
  const wallClockMs = performance.now() - started;
  const results = mergeQuoteResults(dataset, config, perRequest);
  const requestRows = perRequest.map((entry) => entry.row);
  const cnyPerUsd = config.cny_per_usd ?? DEFAULT_CNY_PER_USD;
  const run = {
    schema_version: RUN_SCHEMA,
    run_id: runId,
    arm_id: config.arm_id,
    kind: "llm",
    execution_mode: executionMode,
    created_at: new Date().toISOString(),
    git: gitInfo(),
    config: redactDeep(config),
    config_sha256: sha256Text(JSON.stringify(config)),
    prompt_version: PROMPT_VERSION,
    library: { version: library.version, sha256: library.sha256 },
    dataset: { id: dataset.id, path: dataset.path, sha256: dataset.sha256, quotes: dataset.quotes.length, limit },
    provider: { id: providerId, model_id: config.provider.model_id },
    dimensions: config.dimensions,
    system_prompts: unitPrompts.map((unit) => ({
      dimensions: unit.dimensions,
      sha256: sha256Text(unit.system),
      text: unit.system,
    })),
    summary: summarize({ config, results, requestRows, wallClockMs, cnyPerUsd }),
    requests: requestRows,
    results,
  };
  fs.mkdirSync(runDir, { recursive: true });
  writeJson(path.join(runDir, "run.json"), run);
  return { plan, preview: null, run, runDir };
}

export { DIMENSIONS };
