import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { representationC } from "../src/representations.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const library = JSON.parse(
  readFileSync(join(root, "data/library/atomic-tag-library.v1.json"), "utf8"),
);
const cleanup = JSON.parse(
  readFileSync(join(root, "data/candidates/cleanup-log.v1.json"), "utf8"),
);
const lto = JSON.parse(
  readFileSync(join(root, "data/lto/themes-selected.v1.json"), "utf8"),
);

test("library is research-only and does not claim production migration", () => {
  assert.equal(library.research_only, true);
  assert.equal(library.production_migration, false);
  assert.match(library.library_version, /^atomic-tag-library\.v1\.41/);
});

test("Theme and Device counts are in expected bands", () => {
  assert.ok(library.themes.length >= 100 && library.themes.length <= 300);
  assert.ok(library.devices.length >= 15 && library.devices.length <= 60);
});

test("canonical / aliases / related remain structurally distinct", () => {
  for (const tag of [...library.themes, ...library.devices]) {
    assert.ok(!tag.aliases.includes(tag.canonical_zh), tag.canonical_zh);
    for (const a of tag.aliases) {
      assert.ok(!tag.related.includes(a), `${tag.canonical_zh} alias/related overlap: ${a}`);
    }
    const c = tag.representations.C_label_definition_aliases;
    const aliasSection = c.split("｜别名：")[1] || "";
    const aliasTokens =
      aliasSection === "（无）" ? [] : aliasSection.split("、").filter(Boolean);
    for (const r of tag.related) {
      assert.ok(
        !aliasTokens.includes(r),
        `${tag.canonical_zh}: related ${r} listed in C aliases`,
      );
    }
    assert.equal(
      c,
      representationC(tag.canonical_zh, tag.definition, tag.aliases),
    );
  }
});

test("every tag has provenance and definition", () => {
  for (const tag of [...library.themes, ...library.devices]) {
    assert.ok(tag.provenance.length >= 1, tag.canonical_zh);
    assert.ok(tag.definition.trim().length >= 6, tag.canonical_zh);
  }
});

test("cleanup log preserves evidence (no silent deletes)", () => {
  assert.ok(cleanup.decisions.length > 0);
  assert.ok(cleanup.policy.some((p) => /evidence|raw/i.test(p)));
});

test("LTO extract preserves upstream provenance fields", () => {
  assert.equal(lto.schema_version, "lto-theme-extract.v1");
  assert.match(lto.meta.source_repo, /theme-ontology\/theming/);
  assert.ok(lto.meta.total_upstream_themes > 2000);
  assert.ok(lto.themes.length > 50);
  const sample = lto.themes.find((t) => t.upstream_name === "fear") || lto.themes[10];
  assert.ok(sample.upstream_id.startsWith("lto:theme:"));
  assert.ok(Array.isArray(sample.parents));
  assert.equal(typeof sample.depth, "number");
  assert.ok("definition" in sample);
});

test("Scene/Time is not an active Theme dimension", () => {
  assert.deepEqual(library.dimensions.active, ["theme", "device"]);
  assert.ok(library.dimensions.inactive.includes("scene_time"));
  const time = library.themes.find((t) => t.canonical_zh === "时间");
  assert.ok(time);
  assert.equal(time.status, "excluded_scene_time_conflict");
});
