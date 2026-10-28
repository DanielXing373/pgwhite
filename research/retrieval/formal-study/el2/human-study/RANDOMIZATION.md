# EL2 assignment specification (`el2-assignment.v1`)

Phase 2 implements this. Do not run a production assigner in Phase 1.

## Goals

1. Control vs Disclosure approximately equal among **completed** sessions.
2. Each participant: 10 distinct IDs from the 20 eligible quotes.
3. Quote exposure counts stay close to uniform.
4. Exposure is balanced across groups.
5. Each quote appears about equally often in section 1 vs section 2.
6. Quote order inside a section is random.
7. A–D source order is independent per question; E is fixed.
8. Refresh does not mint a new assignment.
9. Existing sessions are never regenerated.
10. Public participant IDs are not sequential and not guessable.

## Session token

On first GET, the server generates 32 cryptographically random bytes, stores `session_public_id` as lowercase hex (64 chars) or a UUID v4 **plus** 16 random bytes. Do not use auto-increment integers in URLs. Persist `assignment_json` and `algorithm_version = el2-assignment.v1` in the same transaction as the session row.

Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, name not equal to PGWhite auth cookies. LocalStorage may cache answers keyed by `session_public_id` but the server assignment is authoritative.

## Balancing counters

Maintain:

- `completed_group[control|disclosure]`
- `inflight_group[control|disclosure]` — sessions with `in_progress` and `last_seen_at` within 24h
- `completed_quote_group_section[quote_id][group][section]`
- `inflight_quote_group_section[...]` same shape

**Completed** counters update only on successful submit. **In-flight** counters increment at assignment and decrement on submit, explicit abandon, or 24h timeout. Concurrent requests must assign inside a transaction (or row locks on a counter table) so two tabs cannot both take the globally least-used quote pack without recording holds.

Abandoned in-flight sessions do not count toward completed balance. They do occupy in-flight capacity so a burst of opens cannot pin every participant on the same 10 quotes.

## Algorithm

```
rng := CSPRNG
group := argmin(completed_group[g] + inflight_group[g]); tie → rng bit
need := 5 section-1 slots + 5 section-2 slots
quotes := greedy 10-sample:
  while |selected| < 10:
    score(q) = completed+inflight exposure of q
             + |completed+inflight exposure of q in this group − mean|
    pick q with minimal score among remaining eligible; ties → rng
  assign 5 of the 10 to section 1 minimizing |section1_count − section2_count|
    across historical+inflight counters; ties → rng
  shuffle the 5 IDs in section 1; shuffle section 2
for each question:
  permutation := shuffle [human-gold, embedding-top2, gpt-6-luna, deepseek-flash]
  map A,B,C,D := permutation
  E := none_of_the_above
persist assignment; increment inflight counters
```

Do not use a hash of the public id to derive quotes (guessable if the algorithm is public). CSPRNG only.

## Persistence

Never UPDATE `assignment_json` for an existing `session_public_id`. A second GET with the same cookie returns the stored row.

## Tests (Phase 2)

1. Unit: same session id → identical assignment.
2. Simulation: 2 000 synthetic sessions, in-flight timeout mix 10% abandon. Checks:
   - |n_control − n_disclosure| / n < 0.05 among completed
   - quote exposure CV < 0.15
   - per-quote |control − disclosure| max ≤ 3 for n≈200 completed (tune with sim)
   - P(section=1) per quote ∈ [0.40, 0.60]
3. Chi-square or exact tests are diagnostic, not a launch gate by themselves.
4. Leak test: assignment API to the browser includes A–D **Theme labels only** (definitions withheld since copy v3), not `source_id`.

Synthetic example (not a live assignment): session `a1b2…`, group `disclosure`, section1 `[batch1-calib-007, …]`, option A maps to opaque theme-set id `c0ffee…` resolved server-side.
