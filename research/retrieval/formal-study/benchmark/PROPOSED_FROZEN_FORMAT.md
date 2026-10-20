# Proposed formal frozen benchmark format

After human review, generate (do not invent Themes):

`research/retrieval/formal-study/benchmark/formal-benchmark.v1.frozen.json`

```json
{
  "schema_version": "retrieval-benchmark.v1",
  "benchmark_version": "formal-benchmark.v1.frozen",
  "status": "frozen",
  "calibration": true,
  "exploratory": false,
  "research_only": true,
  "ontology_version": "atomic-tag-library.v1.43",
  "ontology_sha256": "a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7",
  "created_at": "<ISO>",
  "git_commit_sha": "<SHA at freeze>",
  "notes": [
    "Formal study GT after human review of 58 quotes.",
    "Missing-ontology invention is out of scope.",
    "Do not edit after freeze; log disputes in formal-study/adjudication/."
  ],
  "quotes": [
    {
      "quote_id": "batch1-calib-001",
      "text_zh": "...",
      "batch": "batch1",
      "source": "...",
      "expected_theme_ids": ["..."],
      "expected_theme_labels": ["..."],
      "ambiguity_flags": [],
      "zero_theme": false,
      "human_review_status": "APPROVED",
      "notes": "..."
    }
  ]
}
```

Original fixtures under `research/retrieval/benchmark/fixtures/` remain untouched.
