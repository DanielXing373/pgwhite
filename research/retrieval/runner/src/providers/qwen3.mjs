import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { assertEmbeddingBatch } from "./interface.mjs";

const DEFAULT_MODEL = "Qwen/Qwen3-Embedding-0.6B";

function defaultWorkerPath() {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "../../python/embed_qwen3.py",
  );
}

/**
 * Resolve python executable without hardcoding machine-specific paths.
 * Prefer explicit option, then PGWHITE_PYTHON / PYTHON_EXECUTABLE, then python/python3.
 */
export function resolvePythonExecutable(options = {}) {
  if (options.python_executable) return String(options.python_executable);
  if (process.env.PGWHITE_PYTHON) return process.env.PGWHITE_PYTHON;
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  if (process.platform === "win32") return "python";
  return "python3";
}

export function buildQwen3WorkerArgs(options = {}) {
  const model = options.model ?? DEFAULT_MODEL;
  const args = [
    options.worker_script ?? defaultWorkerPath(),
    "--model",
    model,
    "--batch-size",
    String(options.batch_size ?? 32),
  ];
  if (options.normalize_embeddings === false) {
    args.push("--no-normalize-embeddings");
  } else {
    args.push("--normalize-embeddings");
  }
  if (options.trust_remote_code === false) {
    args.push("--no-trust-remote-code");
  } else {
    args.push("--trust-remote-code");
  }
  // Default require_cuda=true so experiment conditions cannot silently drift to CPU.
  const requireCuda = options.require_cuda !== false;
  if (requireCuda) args.push("--require-cuda");
  if (options.device != null && options.device !== "") {
    args.push("--device", String(options.device));
  }
  return { model, args, requireCuda };
}

/**
 * Real local Qwen3 embedding provider via Sentence Transformers Python worker.
 * Portable: no absolute cache paths, usernames, drive letters, or fixed GPU ids.
 */
export function createQwen3EmbeddingProvider(options = {}) {
  const python = resolvePythonExecutable(options);
  const workerScript = options.worker_script ?? defaultWorkerPath();
  const { model, args, requireCuda } = buildQwen3WorkerArgs({
    ...options,
    worker_script: workerScript,
  });

  if (!existsSync(workerScript)) {
    throw new Error(
      `Qwen3 worker script not found: ${workerScript}. ` +
        `Ensure the repository checkout includes research/retrieval/runner/python/embed_qwen3.py`,
    );
  }

  /** @type {import('node:child_process').ChildProcessWithoutNullStreams | null} */
  let child = null;
  /** @type {import('node:readline').Interface | null} */
  let rl = null;
  /** @type {{resolve: Function, reject: Function} | null} */
  let pending = null;
  let readyPromise = null;
  let stderrBuf = "";
  let runtimeMeta = {
    provider_id: "qwen3-embedding",
    model_name: model,
    model_identifier: model,
    model_revision: options.model_revision ?? null,
    dimensions: null,
    device: options.device ?? null,
    normalize_embeddings: options.normalize_embeddings !== false,
    batch_size: options.batch_size ?? 32,
    require_cuda: requireCuda,
    python_executable: python,
    worker_script: "research/retrieval/runner/python/embed_qwen3.py",
    status: "not_started",
    backend: "sentence-transformers",
  };

  function failPending(err) {
    if (pending) {
      const p = pending;
      pending = null;
      p.reject(err);
    }
  }

  function ensureWorker() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      child = spawn(python, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          PYTHONIOENCODING: "utf-8",
        },
      });
      stderrBuf = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderrBuf += chunk;
        if (stderrBuf.length > 20000) stderrBuf = stderrBuf.slice(-20000);
      });
      child.on("error", (err) => {
        const wrapped = new Error(
          `Failed to start Python for Qwen3 provider (${python}): ${err.message}. ` +
            `Install Python 3 and a venv with CUDA PyTorch + sentence-transformers. ` +
            `Optional: set PGWHITE_PYTHON to the venv python executable name/path.`,
        );
        runtimeMeta = {
          ...runtimeMeta,
          status: "spawn_failed",
          error: wrapped.message,
        };
        readyPromise = null;
        failPending(wrapped);
        reject(wrapped);
      });
      child.on("exit", (code, signal) => {
        const msg =
          `Qwen3 embedding worker exited (code=${code}, signal=${signal}). ` +
          (stderrBuf.trim() ? `stderr: ${stderrBuf.trim()}` : "");
        runtimeMeta = { ...runtimeMeta, status: "exited", error: msg };
        const err = new Error(msg);
        readyPromise = null;
        child = null;
        rl = null;
        failPending(err);
        // If still waiting for ready, reject that promise too.
        reject(err);
      });

      rl = createInterface({ input: child.stdout });
      let settledReady = false;
      rl.on("line", (line) => {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch (err) {
          const e = new Error(
            `Invalid JSON from Qwen3 worker: ${String(err)} | line=${line}`,
          );
          if (!settledReady) {
            settledReady = true;
            reject(e);
          }
          failPending(e);
          return;
        }

        if (!settledReady) {
          settledReady = true;
          if (!msg?.ok) {
            const e = new Error(
              msg?.error ||
                `Qwen3 worker failed to start. stderr: ${stderrBuf.trim()}`,
            );
            runtimeMeta = { ...runtimeMeta, status: "failed", error: e.message };
            reject(e);
            return;
          }
          if (msg.metadata) {
            runtimeMeta = {
              ...runtimeMeta,
              ...msg.metadata,
              status: "ready",
              python_executable: python,
            };
          } else {
            runtimeMeta = { ...runtimeMeta, status: "ready" };
          }
          resolve();
          return;
        }

        if (pending) {
          const p = pending;
          pending = null;
          if (!msg?.ok) {
            p.reject(
              new Error(
                msg?.error ||
                  `Qwen3 worker request failed. stderr: ${stderrBuf.trim()}`,
              ),
            );
            return;
          }
          p.resolve(msg);
        }
      });
    });
    return readyPromise;
  }

  function request(payload) {
    return ensureWorker().then(
      () =>
        new Promise((resolve, reject) => {
          if (!child?.stdin) {
            reject(new Error("Qwen3 worker stdin unavailable"));
            return;
          }
          if (pending) {
            reject(new Error("Qwen3 worker request overlap (internal error)"));
            return;
          }
          pending = { resolve, reject };
          child.stdin.write(`${JSON.stringify(payload)}\n`, "utf8");
        }),
    );
  }

  return {
    getMetadata() {
      return { ...runtimeMeta };
    },
    async embed(texts) {
      const list = Array.isArray(texts) ? texts : [texts];
      const msg = await request({ op: "embed", texts: list });
      const vectors = msg.vectors;
      assertEmbeddingBatch(list, vectors, runtimeMeta.dimensions ?? undefined);
      if (msg.dimensions != null) {
        runtimeMeta = {
          ...runtimeMeta,
          dimensions: msg.dimensions,
          status: "ready",
        };
      }
      return vectors.map((v) => [...v]);
    },
    async close() {
      if (!child) return;
      try {
        await request({ op: "shutdown" });
      } catch {
        // ignore
      }
      try {
        child.kill();
      } catch {
        // ignore
      }
      child = null;
      rl = null;
      readyPromise = null;
      pending = null;
    },
  };
}
