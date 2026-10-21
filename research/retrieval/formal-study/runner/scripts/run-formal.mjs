#!/usr/bin/env node
/**
 * Formal study runner. dry-run performs no GPU and no network calls.
 * paid-api does nothing unless --allow-paid-api is present.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeFormalStudy } from "../src/execute.mjs";
import { redactSecrets } from "../src/safety.mjs";

function take(argv, index, flag) {
  const value = argv[index];
  if (value == null || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

export function parseFormalArgs(argv) {
  const out = {
    stage: null,
    executionMode: null,
    config: null,
    runId: null,
    allowPaidApi: false,
    representation: null,
    instructionMode: null,
    taskInstruction: null,
    provider: null,
    model: null,
    retrievalArtifact: null,
    candidateK: null,
    maxRequests: null,
    maxEstimatedBudgetUsd: null,
    timeoutMs: null,
    retryLimit: null,
    pricing: null,
    includeAliases: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") out.help = true;
    else if (flag === "--allow-paid-api") out.allowPaidApi = true;
    else if (flag === "--include-aliases") out.includeAliases = true;
    else if (flag === "--stage") out.stage = take(argv, ++i, flag);
    else if (flag === "--execution-mode") out.executionMode = take(argv, ++i, flag);
    else if (flag === "--config") out.config = take(argv, ++i, flag);
    else if (flag === "--run-id") out.runId = take(argv, ++i, flag);
    else if (flag === "--representation") out.representation = take(argv, ++i, flag);
    else if (flag === "--instruction-mode") out.instructionMode = take(argv, ++i, flag);
    else if (flag === "--task-instruction") out.taskInstruction = take(argv, ++i, flag);
    else if (flag === "--provider") out.provider = take(argv, ++i, flag);
    else if (flag === "--model") out.model = take(argv, ++i, flag);
    else if (flag === "--retrieval-artifact") out.retrievalArtifact = take(argv, ++i, flag);
    else if (flag === "--candidate-k") out.candidateK = take(argv, ++i, flag);
    else if (flag === "--max-requests") out.maxRequests = take(argv, ++i, flag);
    else if (flag === "--max-estimated-budget-usd") out.maxEstimatedBudgetUsd = take(argv, ++i, flag);
    else if (flag === "--timeout-ms") out.timeoutMs = take(argv, ++i, flag);
    else if (flag === "--retry-limit") out.retryLimit = take(argv, ++i, flag);
    else if (flag === "--pricing") out.pricing = take(argv, ++i, flag);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return out;
}

function usage() {
  return `Usage:
  run-formal.mjs --stage retrieval|selection --execution-mode dry-run|local|paid-api --config <path> [options]

Options:
  --run-id <id>                         Required for local and paid-api
  --allow-paid-api                      Required before any paid request
  --representation A|B|C                Overrides the config and is stored in the effective snapshot
  --instruction-mode none|prompt_name=query|task_instruct
  --task-instruction <text>             Only with task_instruct
  --provider <id>
  --model <model-id>                    Required for selectors; not a universal default
  --retrieval-artifact <run.json>       Stored retrieval run for the selector
  --candidate-k <n>
  --include-aliases
  --max-requests <n>
  --max-estimated-budget-usd <amount>
  --timeout-ms <n>
  --retry-limit <n>
  --pricing <catalog.json>
`;
}

async function main() {
  const args = parseFormalArgs(process.argv);
  if (args.help || !args.config || !args.executionMode) {
    console.log(usage());
    if (!args.help) process.exitCode = 1;
    return;
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
  const result = await executeFormalStudy({
    repoRoot,
    configPath: args.config,
    executionMode: args.executionMode,
    allowPaidApi: args.allowPaidApi,
    runId: args.runId,
    cli: {
      stage: args.stage,
      representation: args.representation,
      instruction_mode: args.instructionMode,
      task_instruction: args.taskInstruction,
      provider: args.provider,
      model: args.model,
      retrieval_artifact: args.retrievalArtifact,
      candidate_k: args.candidateK,
      include_aliases: args.includeAliases,
      max_requests: args.maxRequests,
      max_estimated_budget_usd: args.maxEstimatedBudgetUsd,
      timeout_ms: args.timeoutMs,
      retry_limit: args.retryLimit,
      pricing: args.pricing,
    },
  });
  if (result.plan) {
    console.log(JSON.stringify(result.plan, null, 2));
    return;
  }
  const run = result.run;
  console.log(JSON.stringify({
    ok: run.status === "completed",
    status: run.status,
    run_id: run.run_id,
    run_dir: result.runDir ?? null,
    stage: run.stage,
    effective_config_sha256: run.effective_config_sha256,
    aggregate_metrics: run.aggregate_metrics,
    cost_summary: run.cost_summary ?? null,
    performance_metrics: run.performance_metrics,
  }, null, 2));
  if (run.status !== "completed") process.exitCode = 3;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(redactSecrets(error?.stack || error?.message || String(error)));
    process.exitCode = 1;
  });
}
