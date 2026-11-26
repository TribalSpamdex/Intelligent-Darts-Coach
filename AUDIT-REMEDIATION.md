# V2.0.0 audit remediation register

Baseline: independent V1.9.0-dev audit, main 112660157bbd84a794ae423cf671878f2392c809.
Development only; this register does not certify closure. Do not merge while any high-severity finding remains unresolved or CI is red.

| Finding | Implementation / regression | Remaining release gate |
| --- | --- | --- |
| H1 Concurrent writes | Exclusive origin Web Lock, primary compare before write; browser two-document probe | Both browser engines, contention and interruption; real iPhone |
| H2 Readiness bypass | Fail-closed native throwing entry/resume gates; active readiness change pauses training; browser stop probe | Exercise, assessment, casual and resume paths independently exercised end-to-end |
| H3 Undelivered intervention learning | Runtime-only allocation proof; three separate completed attributable sessions, >=240 additional elapsed seconds each plus matching actual recorded round; no credit or penalty without proof; zero-delivery and ledger regressions | Positive/negative delivery fixtures, corrected records, prospective calibration; elapsed activity is not measured throwing time |
| H4 Future information | As-of projection of observations, contexts, dated facts, goals and intervention lifecycle; replay regression | Full chronological adversarial matrix; legacy deletions/cancellations without event provenance cannot be exactly reconstructed; same-day ordering limitation |
| H5 Identical plans | Supported fixed measurements bound independent skill difficulty; native eligible selection preference and actual initial/locked planner preview; five-profile/mixed-skill regression | Independently demonstrate actual native adaptation across profiles and completed training; initial allocation can change after warm-up |
| H6 Forged measurements | Canonical reserved precision protocol identity and denominator checks; invalid import regression | Audit every reserved/native protocol and import path |
| M1 Stale recovery | Rotate recovery fence before primary replacement; obsolete checkpoint cannot restore deleted data; isolated corruption probe | Browser interruption/recovery matrix, valid current checkpoint and explicit restore |
| M2 Abandoned delivery | Completed session required for transfer audit and attribution | Duplicate/abandoned/interrupted activities |
| M3 Correlated stationary false trends | Multi-scale dependence allowance, sustained-decline detection, diagnostic-only warning, independent stationary/decline cohorts | Re-run original stationary IID and AR tests, calibrate sensitivity/specificity without retrospective tuning |
| M4 Future linked gameplay | Match round date and activity timestamps | Regression and cross-midnight policy; ambiguous rounds deliberately excluded |
| M5 Legal misses before finishing dart | Exact finish validation admits missed darts before valid terminal double | Independent enumeration and browser input |
| M6 Competition preparation | Native event-week measured preference, near-event familiar drill preference and optional escalation veto; browser probe | Integrated, competition-specific preparation and post-match evaluation |
| M7 Bounded dialogue | In-hand checkout phrasing, spoken numbers, reported before/after accuracy with independent-day question; exact Sol prompts tested | Broader independent paraphrase coverage |
| Other | Retention confounder veto; previous IDC cache generations removed only on successful activation | Interrupted offline upgrade, long-history performance, physical device, independent evidence review |

Verification: GitHub Actions is authoritative for the exact candidate SHA. Earlier red runs exposed obsolete test assumptions and missing fixture provenance; preserve stronger positive and negative assertions. No test pass count is inherited from a different commit.

Original V6.2 and live V1.9.0-dev must remain untouched until release gates pass. The eventual independent re-audit must reproduce all original findings using Sol's evidence archive.

## Verification anchors and statistical calibration

- Intermediate SHA `c07533e20c4fb9bf08c45d83925f3654357dfbb5`, Actions run 45857190027: **430/430** Node tests; both Chromium and WebKit passed, each with 259 native game configurations. This does not certify later changes.
- SHA `c77017324e0836f47417015e81995fa7ef1efbca`, run 45858048141: **435 passed, 1 failed**. The original 10,000-history test passed the severe-decline focus threshold but failed the combined investigation-or-focus coverage threshold. The original criteria are unchanged. Commit 33e683a adds diagnostic-only warnings without permission to allocate additional practice.
- Held-out synthetic results from that run:

| Generator | Histories | Trend flags | Intervention flags |
|---|---:|---:|---:|
| IID stationary | 500 | 0 | 0 |
| AR(.9) stationary | 500 | 10 | 4 |
| AR(.95), 20% missing, 3 protocols | 300 | 20 | 13 |
| AR(.9), imposed 15-point decline | 500 | 276 | 250 |
| AR(.9), imposed 8-point decline | 500 | 78 | 65 |

The two imposed-decline cohorts had zero wrong-direction trend flags. Sol's original AR(.9) null flagged 131/500 (26.2%); our 10/500 (2%) cohort has a different seed, not an exact paired replay. These engineering thresholds are not statistically calibrated probabilities, nor prospective player validation. The low sensitivity for mild changes is a limitation.

- H6 additionally reserves the native IDC V6.2 protocol namespace against ordinary manual imported measurements; rejected imports must not replace the current profile. Valid-looking fabricated source records cannot be authenticated by an offline manual-input application.
- Native competition constraints modify selection inside the existing planner, not the workload or a player's hidden ability. A complete event-specific multi-week training and post-match outcome programme is still outstanding.
- Historical analysis reconstructs currently available dated records; it is not an immutable record of the decision originally made. Legacy deletions, overwritten records and intra-day chronology remain limitations.

No current release readiness score is asserted. Final verification must use the exact current SHA and independent evidence, including physical iPhone operation.
