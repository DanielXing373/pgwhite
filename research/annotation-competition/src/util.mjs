import crypto from "node:crypto";
import fs from "node:fs";

export function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function sha256Text(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** LF + trailing newline so SHA-256 is stable across Windows/Linux checkouts. */
export function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Small deterministic PRNG (mulberry32). Research sampling/shuffling only. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Comparison form for evidence/duplicate checks: NFKC, no whitespace, unified quote marks. */
export function normalizeForMatch(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[“”„‟"「」『』]/g, '"')
    .replace(/[‘’‚‛']/g, "'");
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) {
      args[key] = true;
    } else {
      (args[key] ??= []).push(next);
      i += 1;
    }
  }
  return args;
}

export function one(args, key, fallback = null) {
  const value = args[key];
  if (value == null) return fallback;
  if (value === true) return true;
  return value[value.length - 1];
}

export function many(args, key) {
  const value = args[key];
  return Array.isArray(value) ? value : [];
}
