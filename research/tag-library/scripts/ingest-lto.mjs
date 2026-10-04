#!/usr/bin/env node
/**
 * Research-only Literary Theme Ontology (LTO) ingestion.
 *
 * Reads upstream notes/themes/primary.th.txt from a local clone of
 * https://github.com/theme-ontology/theming and writes:
 *   - data/lto/hierarchy-summary.v1.json
 *   - data/lto/themes-selected.v1.json
 *
 * Does NOT mutate production tags.
 *
 * Usage:
 *   node research/tag-library/scripts/ingest-lto.mjs --lto-dir /path/to/theming
 *   LTO_DIR=/path/to/theming npm run research:taglib:ingest-lto
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../data/lto");

const EXACT = [
  "the human world", "human nature", "personal human experience", "society", "what life is like",
  "humans in pairs", "humans in group", "individual humans", "human idea about life", "coping with life issues",
  "human emotion", "human regular activity", "philosophy", "aesthetics", "folk belief", "organized religion",
  "the nature of love", "the nature of death", "the nature of fear", "the nature of human emotions",
  "the nature of nightmares", "the nature of the subconscious", "the wish to live", "the nature of memory",
  "rationality vs. emotionality", "the human capacity for good and evil", "nature vs. nurture",
  "anger", "fear", "jealousy", "pride", "shame", "hope", "loneliness", "boredom", "awe", "compassion", "grief",
  "nostalgia", "desire", "obsession", "love", "friendship", "betrayal", "divorce", "abandonment", "courage",
  "cowardice", "honesty", "cruelty", "mercy", "slavery", "crime", "suicide", "murder", "war", "destiny",
  "music", "exile", "belonging", "homesickness", "orphanhood", "human childhood", "human parenting",
  "parental love", "filial love", "romantic love", "tragic love", "romantic jealousy", "romantic infidelity",
  "human addiction", "childhood trauma", "coping with aging", "coping with mortality", "the afterlife",
  "personal identity", "gender identity", "what is truth", "what is justice", "what is beauty", "the soul",
  "human dreaming", "descent into madness", "social oppression", "corruption in society", "power corrupts",
  "the desire for redemption", "the importance of faith", "sin", "human self-sacrifice", "sexism in society",
  "poverty in society", "immigration in society", "humans at work", "human sexuality", "facing death",
  "fear of death", "acute anxiety", "survivor guilt", "self-deception", "exercising self-control",
  "controlling partner", "domestic violence", "the instinct for violence", "pleasure in violence",
  "human vs. nature", "pleasure in nature", "reminiscence about one's youth", "youth rebellion",
  "single motherhood", "single fatherhood", "mother and son", "mother and daughter", "father and son",
  "father and daughter", "family dispute", "family honor", "dark family secret", "arranged marriage",
  "mixed marriage", "marriage of convenience", "coping with a failing marriage", "love vs. friendship",
  "duty vs. desire", "desire vs. conscience", "order vs. freedom", "security vs. freedom", "the need for freedom",
  "poetic justice", "vigilante justice", "mercy vs. justice", "hate begets hate", "love-hate relationship",
  "obsessive love", "nostalgic love", "epic love", "free love", "old-age love", "sororal love",
  "contemplating suicide", "honorable suicide", "mental illness", "coping with a terminal illness",
  "coping with post-traumatic stress", "overcoming an addiction", "vow of silence", "peace on Earth",
  "civil war", "war crime", "modern slavery", "violent crime", "organized crime", "crime of passion",
  "what it is like in prison", "child abuse", "human sacrifice", "sacrifice for a child", "sacrifice for a friend",
  "sacrifice for one's beliefs", "courage in the face of death", "the importance of being honest",
  "true beauty comes from within", "beauty is in the eye of the beholder", "mimetic desire",
  "the desire to survive", "the desire for justice", "lucid dreaming", "dream interpretation",
  "alternate reality", "the natural world", "science", "speculative society", "history",
  "cross cultural issue", "national social issue", "social ethical issue", "international issue",
];

function parseArgs(argv) {
  const out = { ltoDir: process.env.LTO_DIR || "" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--lto-dir") out.ltoDir = argv[++i];
  }
  return out;
}

function parsePrimary(text) {
  const lines = text.split(/\r?\n/);
  const themes = [];
  let i = 0;
  while (i < lines.length - 1) {
    if (/^=+$/.test(lines[i + 1].trim()) && lines[i].trim() && !lines[i].startsWith("::")) {
      const title = lines[i].trim();
      i += 2;
      const fields = {};
      let cur = null;
      const buf = [];
      while (i < lines.length) {
        if (
          i + 1 < lines.length &&
          /^=+$/.test(lines[i + 1].trim()) &&
          lines[i].trim() &&
          !lines[i].startsWith("::")
        ) {
          break;
        }
        const line = lines[i];
        if (line.startsWith(":: ")) {
          if (cur != null) fields[cur] = buf.join("\n").trim();
          cur = line.slice(3).trim();
          buf.length = 0;
        } else if (cur != null) {
          buf.push(line);
        }
        i += 1;
      }
      if (cur != null) fields[cur] = buf.join("\n").trim();
      themes.push({
        name: title,
        description: fields.Description || null,
        parents: (fields.Parents || "").split("\n").map((s) => s.trim()).filter(Boolean),
        aliases: (fields.Aliases || "").split("\n").map((s) => s.trim()).filter(Boolean),
        references: (fields.References || "").split("\n").map((s) => s.trim()).filter(Boolean),
        examples: fields.Examples || null,
      });
    } else {
      i += 1;
    }
  }
  return themes;
}

function depthOf(name, parentMap, memo = new Map(), stack = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (stack.has(name)) return 0;
  const parents = parentMap.get(name);
  if (parents == null) return -1;
  if (!parents.length) {
    memo.set(name, 0);
    return 0;
  }
  stack.add(name);
  const ds = parents.map((p) => depthOf(p, parentMap, memo, stack)).filter((d) => d >= 0);
  stack.delete(name);
  const d = ds.length ? 1 + Math.max(...ds) : 0;
  memo.set(name, d);
  return d;
}

function ancestors(name, parentMap) {
  const out = [];
  const seen = new Set();
  const stack = [...(parentMap.get(name) || [])];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    stack.push(...(parentMap.get(p) || []));
  }
  return out;
}

function count(arr) {
  const c = {};
  for (const x of arr) c[x] = (c[x] || 0) + 1;
  return c;
}

function main() {
  const { ltoDir } = parseArgs(process.argv);
  if (!ltoDir) {
    console.error("Missing --lto-dir or LTO_DIR (path to theme-ontology/theming clone).");
    process.exit(1);
  }
  const primary = join(resolve(ltoDir), "notes/themes/primary.th.txt");
  if (!existsSync(primary)) {
    console.error(`Not found: ${primary}`);
    process.exit(1);
  }

  let commit = "unknown";
  let commitDate = "unknown";
  try {
    commit = execSync("git rev-parse HEAD", { cwd: ltoDir, encoding: "utf8" }).trim();
    commitDate = execSync("git log -1 --format=%ci", { cwd: ltoDir, encoding: "utf8" }).trim();
  } catch {
    // optional
  }

  const themes = parsePrimary(readFileSync(primary, "utf8"));
  const byName = new Map(themes.map((t) => [t.name, t]));
  const parentMap = new Map(themes.map((t) => [t.name, t.parents]));
  const children = new Map();
  for (const t of themes) {
    for (const p of t.parents) {
      if (!children.has(p)) children.set(p, []);
      children.get(p).push(t.name);
    }
  }

  const missing = EXACT.filter((n) => !byName.has(n));
  const selected = new Set(EXACT.filter((n) => byName.has(n)));
  for (const n of [...selected]) {
    for (const a of ancestors(n, parentMap)) {
      if (byName.has(a)) selected.add(a);
    }
  }
  for (const c of children.get("human emotion") || []) {
    if (c.split(/\s+/).length <= 2) selected.add(c);
  }

  const records = [...selected].sort().map((n) => {
    const t = byName.get(n);
    return {
      upstream_id: `lto:theme:${n}`,
      upstream_name: n,
      definition: t.description,
      parents: t.parents,
      depth: depthOf(n, parentMap),
      aliases: t.aliases,
      references: t.references,
      children_count: (children.get(n) || []).length,
    };
  });

  const depths = records.map((r) => String(r.depth));
  const upstreamDepths = themes.map((t) => String(depthOf(t.name, parentMap)));

  const meta = {
    source_repo: "https://github.com/theme-ontology/theming",
    source_commit: commit,
    source_commit_date: commitDate,
    license:
      "MIT for themes/ontology content used here; story descriptions are CC BY-SA and are NOT included in this extract",
    attribution:
      "Literary Theme Ontology (Theme Ontology Project). Upstream: https://github.com/theme-ontology/theming and https://www.themeontology.org/",
    theme_file: "notes/themes/primary.th.txt",
    total_upstream_themes: themes.length,
    selected_count: records.length,
    selection_policy:
      "Exact-name curated upper/early-middle literary concepts + ancestors for hierarchy. Rejects fuzzy matches that would pull false friends. Not a blind import of all ~2990 themes.",
    depth_distribution: count(depths),
    missing_requested_exact_names: missing,
    roots: {
      "alternate reality": [...(children.get("alternate reality") || [])].sort(),
      "the human world": [...(children.get("the human world") || [])].sort(),
      "the natural world": [...(children.get("the natural world") || [])].sort(),
    },
    hierarchy_notes: [
      "LTO has 3 roots: alternate reality, the human world, the natural world",
      `Upstream theme count in primary.th.txt: ${themes.length}`,
      "Upstream depth ranges roughly 0–9; mass of themes sits around depth 3–5",
      "Many leaf themes are long phrasal story-situation labels — poor PGWhite atomic tags",
      "PGWhite should mine conceptual mid-nodes and map them to Chinese atomic labels rather than importing English phrasal leaves",
    ],
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "themes-selected.v1.json"),
    `${JSON.stringify({ schema_version: "lto-theme-extract.v1", meta, themes: records }, null, 2)}\n`,
  );
  writeFileSync(
    join(OUT_DIR, "hierarchy-summary.v1.json"),
    `${JSON.stringify(
      {
        schema_version: "lto-hierarchy-summary.v1",
        source_repo: meta.source_repo,
        source_commit: meta.source_commit,
        source_commit_date: meta.source_commit_date,
        license: meta.license,
        attribution: meta.attribution,
        total_upstream_themes: themes.length,
        upstream_depth_distribution: count(upstreamDepths),
        parent_count_distribution_upstream: count(
          themes.map((t) => String(t.parents.length)),
        ),
        fields_present: {
          Description: themes.filter((t) => t.description).length,
          Parents: themes.filter((t) => t.parents.length).length,
          Aliases: themes.filter((t) => t.aliases.length).length,
          References: themes.filter((t) => t.references.length).length,
          Examples: themes.filter((t) => t.examples).length,
        },
        roots: meta.roots,
        hierarchy_notes: meta.hierarchy_notes,
        selected_count: records.length,
        selected_depth_distribution: meta.depth_distribution,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        total_upstream_themes: themes.length,
        selected_count: records.length,
        source_commit: commit,
        out_dir: OUT_DIR,
      },
      null,
      2,
    ),
  );
}

main();
