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

## Recovered-slump regression and independent exact finish oracle

- Full Actions run 45858785119 at `2b38a5162f31721d08cbcf8486f4f1a51ad85551`: 440 passed, one failed. All failures were confined to the original 10,000-history sensitivity/safety test; one recovered-slump case (index 5259, singles) was incorrectly assigned temporary focus.
- A 28-day contrast included a resolved low fortnight even though two subsequent measured weeks had improved. The recovery veto at `f0176bba90c700fad6c3e7d5c36e640f7966b140` forbids long-window-only focus when both weeks show material recovery. Short and persistent decline confirmation remain independent.
- Direct execution of the repository coaching functions (nine fetched modules, loaded into an isolated JavaScript runtime) against the exact seeded 10,000-history generator produced:

| Cohort | Count | Focus | Investigate |
| --- | ---: | ---: | ---: |
| Stable | 2000 | 0 | 6 |
| Genuine severe decline | 2000 | 1734 | 259 |
| Decline with reported equipment change | 2000 | 0 | 1994 |
| Sparse measurements | 2000 | 0 | 0 |
| Recovered slump | 2000 | 0 | 1 |

All original acceptance thresholds were met in this direct run. The exact failing history is a regression at `8513abb50d6d10b56ec0082bc44574e1dee3d64a`. This is not an independent holdout or full Node/Playwright verification.

- Independent exact checkout oracle, including zero-score misses, executed directly against `c10e7afd36f76aa3342e2886a5d56837ed3913c3`: 507/507 score/dart-count pairs agreed. The exhaustive oracle is also committed to the normal Node suite.
- CI for the current exact candidate and a new independent re-audit remain required. No prior green run can certify a later SHA.

## Further integrated verification and remaining gates

- At `aedbfe07ab4e42636585566f4324ce548c282efc` (129 cumulative commits), Actions run 45860295514 passed **445/445** Node tests. Browser execution passed the earlier readiness entry assertion but failed at the obsolete dev2 cache-name assertion (actual generation dev3). Do not report this run as fully green.
- H4: native assessment, outcome audit and accountability now use the as-of lifecycle; future transient outcome permissions and cancellation metadata are removed during replay. Historical baseline correction still uses presently available records, not an immutable deletion ledger.
- M2: abandoned activities are visible separately, and cannot contribute to completed dose or repeated-delivery-shortfall decisions.
- Offline: browser inventory checks the actual worker generation and all 169 versioned/unversioned assets. The dev4 worker serves a consistent cached HTML/module generation until activation; new tests exercise failed installation and generation coherence. Real device update/eviction testing remains required.
- M1: identical primary payloads do not rotate the recovery fence; automatic recovery refreshes the checkpoint after successfully committing restored data. Browser probe requires positive recovery after two consecutive corruptions as well as negative stale-checkpoint exclusion.
- H5: intermediate bull preference changed to Bull Bank because Bull Accuracy is reserved for fixed measurement, not native pressure circuit selection. Five-profile browser sweep holds legacy skill levels constant and examines real native scheduler output.
- H3: skill-specific actual round families are conservatively whitelisted for allocation learning. Single-ring beginner adaptations, missing doubles variant or mismatched receiver skill cannot prove delivered doubles practice. Mixed drills remain valid gameplay but do not establish skill-specific intervention dose. This deliberately sacrifices attribution coverage for specificity; it is not a validated optimal dose rule.

All changes after the 445-test anchor require fresh complete verification. No readiness score or independent audit closure is asserted.
