import {
  DEFAULT_LITERARY_TASK_INSTRUCTION,
  normalizeInstructionMode,
} from "../../../runner/src/qwenInstructionModes.mjs";
import { FROZEN } from "./freeze.mjs";
import { sha256Stable } from "./stableJson.mjs";

function assignExecution(effective, key, value) {
  effective.execution = { ...(effective.execution ?? {}), [key]: value };
}

/**
 * Apply CLI overrides onto a cloned config, then fill values the run will
 * actually use. The returned object is what gets hashed and stored.
 */
export function materializeEffectiveConfig(fileConfig, { cli = {}, env = {} } = {}) {
  const effective = structuredClone(fileConfig);
  const cliOverrides = {};

  if (cli.representation != null) {
    effective.representation = String(cli.representation).toUpperCase();
    cliOverrides.representation = effective.representation;
  }
  if (cli.instruction_mode != null) {
    effective.instruction_mode = normalizeInstructionMode(cli.instruction_mode);
    cliOverrides.instruction_mode = effective.instruction_mode;
  }
  if (cli.task_instruction != null) {
    effective.task_instruction = String(cli.task_instruction);
    cliOverrides.task_instruction = effective.task_instruction;
  }
  if (cli.provider != null) {
    effective.provider = { ...(effective.provider ?? {}), id: String(cli.provider) };
    cliOverrides.provider_id = effective.provider.id;
  }
  if (cli.model != null) {
    if (effective.stage === "retrieval") {
      effective.provider = { ...(effective.provider ?? {}), model: String(cli.model) };
      cliOverrides.model = effective.provider.model;
    } else {
      effective.provider = { ...(effective.provider ?? {}), model_id: String(cli.model) };
      cliOverrides.model_id = effective.provider.model_id;
    }
  }
  if (cli.candidate_k != null) {
    effective.candidate_k = Number(cli.candidate_k);
    cliOverrides.candidate_k = effective.candidate_k;
  }
  if (cli.include_aliases != null) {
    effective.include_aliases = Boolean(cli.include_aliases);
    cliOverrides.include_aliases = effective.include_aliases;
  }
  if (cli.retrieval_artifact != null) {
    effective.retrieval_artifact_path = String(cli.retrieval_artifact);
    cliOverrides.retrieval_artifact_path = effective.retrieval_artifact_path;
  }
  if (cli.pricing != null) {
    effective.pricing_catalog_path = String(cli.pricing);
    cliOverrides.pricing_catalog_path = effective.pricing_catalog_path;
  }
  if (cli.max_requests != null) {
    assignExecution(effective, "max_requests", Number(cli.max_requests));
    cliOverrides.max_requests = effective.execution.max_requests;
  }
  if (cli.max_estimated_budget_usd != null) {
    assignExecution(effective, "max_estimated_budget_usd", Number(cli.max_estimated_budget_usd));
    cliOverrides.max_estimated_budget_usd = effective.execution.max_estimated_budget_usd;
  }
  if (cli.timeout_ms != null) {
    assignExecution(effective, "timeout_ms", Number(cli.timeout_ms));
    cliOverrides.timeout_ms = effective.execution.timeout_ms;
  }
  if (cli.retry_limit != null) {
    assignExecution(effective, "retry_limit", Number(cli.retry_limit));
    cliOverrides.retry_limit = effective.execution.retry_limit;
  }

  if (effective.stage === "retrieval") {
    if (!["A", "B", "C"].includes(effective.representation)) {
      throw new Error(`representation must be A|B|C, got ${effective.representation}`);
    }
    effective.instruction_mode = normalizeInstructionMode(effective.instruction_mode);
    if (effective.instruction_mode !== "task_instruct" && cliOverrides.task_instruction) {
      throw new Error("--task-instruction applies only when instruction_mode is task_instruct");
    }
    if (effective.instruction_mode === "task_instruct") {
      if (!effective.task_instruction) {
        effective.task_instruction = DEFAULT_LITERARY_TASK_INSTRUCTION;
        effective.task_instruction_source = "default_literary_task_instruction";
      } else if (cliOverrides.task_instruction) {
        effective.task_instruction_source = "cli";
      } else {
        effective.task_instruction_source = "config";
      }
    } else {
      effective.task_instruction = null;
      effective.task_instruction_source = null;
    }
    if (effective.provider?.id === "qwen3" && effective.provider.model !== FROZEN.embedding_model) {
      throw new Error(
        `Phase 1 qwen3 embedding model is fixed to ${FROZEN.embedding_model}.`,
      );
    }
    if (effective.reranker != null) {
      throw new Error("Formal Phase 1 retrieval does not run a reranker.");
    }
    if (effective.similarity !== "cosine") {
      throw new Error("Formal retrieval similarity must be cosine.");
    }
    if (effective.normalize_embeddings === false || effective.provider?.normalize_embeddings === false) {
      throw new Error("Formal retrieval requires normalized embeddings.");
    }
  }

  if (effective.stage === "selection") {
    let modelSource = null;
    if (cliOverrides.model_id) modelSource = "cli";
    else if (effective.provider?.model_id) modelSource = "config";
    else if (env.PGWHITE_SELECTOR_MODEL) {
      effective.provider = {
        ...(effective.provider ?? {}),
        model_id: String(env.PGWHITE_SELECTOR_MODEL),
      };
      modelSource = "PGWHITE_SELECTOR_MODEL";
    }
    effective.model_id = effective.provider?.model_id ?? null;
    effective.model_id_source = effective.model_id ? modelSource : null;
    if (effective.max_selected !== 3) {
      throw new Error("Formal selector max_selected must be 3.");
    }
  }

  effective.provenance = { cli_overrides: cliOverrides };
  return effective;
}

export function sealEffectiveConfig(effective, { sourceConfigPath, sourceConfigSha256 }) {
  const sealed = structuredClone(effective);
  sealed.provenance = {
    ...(sealed.provenance ?? {}),
    source_config_path: sourceConfigPath,
    source_config_sha256: sourceConfigSha256,
  };
  return {
    effective: sealed,
    effective_config_sha256: sha256Stable(sealed),
  };
}
