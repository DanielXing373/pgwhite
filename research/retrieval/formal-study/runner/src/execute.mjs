import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadBenchmark } from "../../../runner/src/benchmark.mjs";
import { readJsonFile, resolveRepoPath, sha256File } from "../../../runner/src/io.mjs";
import { createFakeEmbeddingProvider } from "../../../runner/src/providers/fake.mjs";
import { createQwen3EmbeddingProvider } from "../../../runner/src/providers/qwen3.mjs";
import { resolveQwenQueryEncoding } from "../../../runner/src/qwenInstructionModes.mjs";
import { loadTagLibrary, selectActiveThemes } from "../../../runner/src/tagLibrary.mjs";
import { writeFormalRun, assertRunDirAvailable } from "./artifacts.mjs";
import { findPricingRate } from "./cost.mjs";
import { materializeEffectiveConfig, sealEffectiveConfig } from "./effectiveConfig.mjs";
import { verifyDeclaredAsset } from "./freeze.mjs";
import { collectGitInfo } from "./gitInfo.mjs";
import { runRetrievalStage } from "./retrievalStage.mjs";
import { runSelectionStage } from "./selectionStage.mjs";
import { createSelectorProvider } from "./selector/registry.mjs";
import { assertExecutionMode, collectBlockers, createBudgetGuard, isFakeSelectorDryRun } from "./safety.mjs";

export function defaultProviderFactory(effective, { executionMode, env, fetchImpl }) {
  if (executionMode === "dry-run" && !isFakeSelectorDryRun(executionMode, effective.stage, effective.provider?.id)) {
    throw new Error("dry-run must not construct a provider");
  }
  if (effective.stage === "retrieval") {
    if (effective.provider.id === "fake") {
      return createFakeEmbeddingProvider({
        dimensions: effective.provider.dimensions ?? 32,
      });
    }
    if (effective.provider.id === "qwen3") {
      return createQwen3EmbeddingProvider({
        model: effective.provider.model,
        instruction_mode: effective.instruction_mode,
        query_instruction: effective.task_instruction ?? undefined,
        normalize_embeddings: true,
        require_cuda: effective.provider.require_cuda !== false,
      });
    }
    throw new Error(`Unknown retrieval provider ${effective.provider.id}. No fallback will be used.`);
  }
  return createSelectorProvider(effective.provider.id, { env, fetchImpl });
}

function loadPricing(repoRoot, effective) {
  if (!effective.pricing_catalog_path) return null;
  const catalog = readJsonFile(resolveRepoPath(repoRoot, effective.pricing_catalog_path));
  const rate = findPricingRate(catalog, effective.provider.id, effective.model_id);
  if (!rate) return null;
  return {
    ...rate,
    source: rate.source ?? catalog.source ?? null,
    version: rate.version ?? catalog.catalog_version ?? null,
  };
}

export async function executeFormalStudy({
  repoRoot,
  configPath,
  cli = {},
  env = process.env,
  executionMode,
  allowPaidApi = false,
  runId = null,
  providerFactory = null,
  fetchImpl,
  write = true,
  runsRoot = null,
}) {
  const absoluteConfig = resolveRepoPath(repoRoot, configPath);
  const fileConfig = readJsonFile(absoluteConfig);
  const materialized = materializeEffectiveConfig(fileConfig, { cli, env });
  if (cli.stage != null && cli.stage !== materialized.stage) {
    throw new Error(`--stage ${cli.stage} does not match config stage ${materialized.stage}`);
  }
  materialized.execution_mode = executionMode;
  materialized.allow_paid_api = allowPaidApi === true;
  const sealed = sealEffectiveConfig(materialized, {
    sourceConfigPath: configPath,
    sourceConfigSha256: sha256File(absoluteConfig),
  });
  const effective = sealed.effective;
  assertExecutionMode({
    executionMode,
    allowPaidApi,
    stage: effective.stage,
    providerId: effective.provider?.id,
  });
  verifyDeclaredAsset(
    repoRoot,
    effective.ontology_path,
    effective.expected_ontology_sha256,
    "ontology",
  );
  verifyDeclaredAsset(
    repoRoot,
    effective.benchmark_path,
    effective.expected_benchmark_sha256,
    "benchmark",
  );

  const artifactAbs = effective.retrieval_artifact_path
    ? resolveRepoPath(repoRoot, effective.retrieval_artifact_path)
    : null;
  const pricing = effective.stage === "selection" ? loadPricing(repoRoot, effective) : null;
  const blockers = collectBlockers(effective, {
    artifactExists: artifactAbs ? existsSync(artifactAbs) : false,
    pricingRate: pricing,
  });

  const fakeSelectorDryRun = isFakeSelectorDryRun(executionMode, effective.stage, effective.provider?.id);

  if (executionMode === "dry-run" && !fakeSelectorDryRun) {
    const library = loadTagLibrary(repoRoot, effective.ontology_path);
    const themes = selectActiveThemes(library.library, {
      activeStatus: effective.active_status ?? "active_candidate",
    });
    const benchmark = loadBenchmark(repoRoot, effective.benchmark_path);
    const encoding = effective.stage === "retrieval"
      ? resolveQwenQueryEncoding(effective.instruction_mode, "", {
        task_instruction: effective.task_instruction ?? undefined,
      })
      : null;
    return {
      wrote: false,
      plan: {
        dry_run: true,
        calls_provider: false,
        stage: effective.stage,
        execution_mode: executionMode,
        experiment_id: effective.experiment_id,
        effective_config: effective,
        effective_config_sha256: sealed.effective_config_sha256,
        active_theme_count: themes.length,
        quote_count: benchmark.data.quotes.length,
        representation: effective.representation ?? null,
        instruction_mode: effective.instruction_mode ?? null,
        effective_query_instruction: encoding?.effective_query_instruction ?? null,
        provider_id: effective.provider.id,
        model_id: effective.model_id ?? effective.provider.model ?? null,
        blockers,
      },
    };
  }

  if (blockers.length > 0) {
    throw new Error(`STOP: ${blockers.join(" ")}`);
  }
  if (!runId || !/^[A-Za-z0-9._@+=-]+$/.test(runId)) {
    throw new Error("STOP: a unique --run-id is required outside plan-only dry-run.");
  }
  const runsDir = runsRoot
    ?? resolve(repoRoot, effective.runs_dir ?? "research/retrieval/formal-study/runs");
  const runDir = resolve(runsDir, runId);
  if (write) assertRunDirAvailable(runDir);

  const factory = providerFactory
    ?? ((config) => defaultProviderFactory(config, { executionMode, env, fetchImpl }));
  const provider = factory(effective);
  try {
    const git = collectGitInfo(repoRoot);
    const bundle = effective.stage === "retrieval"
      ? await runRetrievalStage({
        repoRoot,
        effectiveConfig: effective,
        effectiveConfigSha256: sealed.effective_config_sha256,
        provider,
        runId,
        git,
      })
      : await runSelectionStage({
        repoRoot,
        effectiveConfig: effective,
        effectiveConfigSha256: sealed.effective_config_sha256,
        provider,
        pricing,
        safety: createBudgetGuard({
          maxRequests: effective.execution?.max_requests ?? null,
          maxEstimatedBudgetUsd: effective.execution?.max_estimated_budget_usd ?? null,
        }),
        runId,
        git,
      });
    if (!write) return { wrote: false, ...bundle, effective };
    writeFormalRun(runDir, {
      run: bundle.run,
      environment: bundle.environment,
      effectiveConfig: effective,
    });
    return { wrote: true, runDir, ...bundle, effective };
  } finally {
    if (typeof provider?.close === "function") {
      try {
        await provider.close();
      } catch {
        // Closing the worker must not hide the run result.
      }
    }
  }
}
