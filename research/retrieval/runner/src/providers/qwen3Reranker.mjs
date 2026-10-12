import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { resolvePythonExecutable } from "./qwen3.mjs";

function defaultWorkerPath() {
  return join(dirname(fileURLToPath(import.meta.url)), "../../python/rerank_qwen3.py");
}

export function createQwen3Reranker(options = {}) {
  const python = resolvePythonExecutable(options);
  const model = options.model ?? process.env.PGWHITE_RERANKER_MODEL ?? "Qwen/Qwen3-Reranker-0.6B";
  const workerScript = options.worker_script ?? defaultWorkerPath();
  const args = [
    workerScript,
    "--model", model,
    "--device", options.device ?? "cuda",
    "--batch-size", String(options.batch_size ?? 8),
  ];

  let child = null;
  let reader = null;
  let pending = null;
  let readyPromise = null;
  let metadata = {
    provider_id: "qwen3-reranker-local",
    model_name: model,
    device: options.device ?? "cuda",
    python_executable: python,
    worker_script: "research/retrieval/runner/python/rerank_qwen3.py",
    status: "not_started",
  };

  function start() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      child = spawn(python, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      });
      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk).slice(-20000);
      });
      child.on("error", (error) => {
        readyPromise = null;
        reject(new Error(`Could not start Qwen3 reranker worker (${python}): ${error.message}`));
      });
      child.on("exit", (code, signal) => {
        const error = new Error(
          `Qwen3 reranker worker exited (code=${code}, signal=${signal}). ${stderr.trim()}`,
        );
        metadata = { ...metadata, status: "exited", error: error.message };
        if (pending) {
          pending.reject(error);
          pending = null;
        }
      });
      reader = createInterface({ input: child.stdout });
      let readySettled = false;
      reader.on("line", (line) => {
        let message;
        try {
          message = JSON.parse(line);
        } catch (error) {
          const wrapped = new Error(`Invalid JSON from reranker worker: ${line}`, { cause: error });
          if (!readySettled) {
            readySettled = true;
            reject(wrapped);
          }
          if (pending) {
            pending.reject(wrapped);
            pending = null;
          }
          return;
        }
        if (!readySettled) {
          readySettled = true;
          if (!message.ok) {
            reject(new Error(message.error ?? `Reranker failed to start. ${stderr.trim()}`));
            return;
          }
          metadata = { ...metadata, ...(message.metadata ?? {}), status: "ready", python_executable: python };
          resolve(metadata);
          return;
        }
        if (pending) {
          const current = pending;
          pending = null;
          if (!message.ok) current.reject(new Error(message.error ?? "Reranker request failed"));
          else current.resolve(message);
        }
      });
    });
    return readyPromise;
  }

  function request(payload) {
    return start().then(() => new Promise((resolve, reject) => {
      if (!child?.stdin) return reject(new Error("Reranker worker stdin unavailable"));
      if (pending) return reject(new Error("Reranker worker request overlap"));
      pending = { resolve, reject };
      child.stdin.write(`${JSON.stringify(payload)}\n`, "utf8");
    }));
  }

  return {
    ready: start,
    getMetadata: () => ({ ...metadata }),
    async rerank(query, documents) {
      const result = await request({ op: "rerank", query, documents });
      if (!Array.isArray(result.scores) || result.scores.length !== documents.length) {
        throw new Error("Reranker returned an invalid score array");
      }
      return result.scores;
    },
    async close() {
      if (!child) return;
      try {
        await request({ op: "shutdown" });
      } catch {
        // Worker may already have failed or exited.
      }
      child.kill();
      child = null;
      reader = null;
      pending = null;
      readyPromise = null;
    },
  };
}
