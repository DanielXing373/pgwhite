import { execSync } from "node:child_process";
import os from "node:os";

function tryGit(repoRoot, command) {
  try {
    return execSync(command, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function collectGitInfo(repoRoot) {
  const sha = tryGit(repoRoot, "git rev-parse HEAD");
  const branch = tryGit(repoRoot, "git rev-parse --abbrev-ref HEAD");
  let dirty = null;
  try {
    const porcelain = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    dirty = porcelain.length > 0;
  } catch {
    dirty = null;
  }
  return {
    git_commit_sha: sha,
    git_branch: branch,
    git_dirty: dirty,
  };
}

export function collectEnvironment(extra = {}) {
  return {
    schema_version: "formal-environment.v1",
    captured_at: new Date().toISOString(),
    node_version: process.version,
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
    },
    cpu: os.cpus()?.[0]?.model ?? null,
    total_mem_bytes: os.totalmem(),
    gpu_name: extra.gpu_name ?? null,
    cuda_device_id: extra.cuda_device_id ?? null,
    cuda_available: extra.cuda_available ?? null,
    torch_version: extra.torch_version ?? null,
    sentence_transformers_version: extra.sentence_transformers_version ?? null,
    python_executable: extra.python_executable ?? null,
    vram_bytes: extra.vram_bytes ?? null,
    notes: extra.notes ?? null,
  };
}
