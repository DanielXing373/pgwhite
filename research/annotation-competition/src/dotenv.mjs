import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.mjs";

// 只读取模型接口相关的变量，数据库口令等其他内容不会进入本进程。
const ALLOWED = new Set(["OPENAI_API_KEY", "OPENAI_BASE_URL", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL"]);

/**
 * Load provider keys from the repo-root .env (gitignored). Like the annotation workbench,
 * a value in .env wins over a stale shell export. Returns the variable NAMES that were
 * loaded; values are never returned or logged.
 */
export function loadProviderEnv({ file = path.join(REPO_ROOT, ".env"), env = process.env } = {}) {
  if (!fs.existsSync(file)) return [];
  const loaded = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !ALLOWED.has(match[1])) continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
    if (!value) continue;
    env[match[1]] = value;
    loaded.push(match[1]);
  }
  return loaded;
}
