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

## Green verification anchor and exact independent replay

- SHA `cf6a7d65bc3e3c53b234ed9bc4f53d3216f2247a`, Actions run 45861716442: **447/447 Node tests**, Chromium and WebKit passed. Native configuration audit 259 per engine (518 total), 239 modified configurations per engine across 37 named games. Native scheduling sweep produced three distinct executable preference/plan families from five measured ability profiles while legacy levels were held constant; the three highest profiles chose the same game families, not identical continuous difficulty. Chromium checked all 169 offline cache entries and operated offline; both engines passed H1/H2/M1 probes and storage isolation.
- Exact original Sol audit generator extracted from the supplied PDF's embedded `independent.mjs`. Direct execution at that SHA reproduced the complete random draw sequence: 100,000 visits, five three-year histories with 699/706/698/680/695 measured days, RNG state 1160098967 before stationary cohorts and 2582045143 after. Independent visit oracle: zero mismatches. Unlike earlier separate-seed calibration, the new result is paired on the exact same original input sequence:

| Stationary history | N | V1.9 audit trend flags | V2.0 direct replay |
| --- | ---: | ---: | ---: |
| Independent daily variation | 500 | 12 (2.4%) | 0 (0%) |
| Serial form AR(.90) | 500 | 131 (26.2%) | 8 (1.6%) |

The relative reduction in the serial cohort is 123/131 (93.9%). These are scenario-specific trend-component flags, not a population error rate or causal benefit. Detection sensitivity remains imperfect, notably for mild true changes. The original generator and all-path oracle are now in `tests/sol-audit-replay.test.mjs`; the new CI suite also checks 190 walk-forward comparisons with canonical fixed-check IDs. Direct replay here consumed the exact three-year generator to establish random sequence identity, not the 190 progression comparisons; those are covered by the new CI test.
- Knowledge: added McKay et al. 2024, DOI 10.1037/bul0000451, and reciprocal links to prior external-focus and darts-specific review. The conflicting evidence supports individual comparisons rather than a universal external-focus prescription.
- H2: readiness change now pauses an assessment warm-up in addition to an active training exercise. Isolated browser regression verifies real Bull Accuracy input, blocked resume, safe resumed input, casual game start/input and assessment warm-up/doubles input. Pending new exact-SHA CI.
- Release gate remains independent re-audit and physical device testing. No published release or original V6.2 modifications.

## Final pre-Sol handover checkpoint

- Commit `30ed82fd8cb22bb8fcfe3a99f9b42fdec6a24c3a` (144 cumulative commits), Actions run 45883400705: **449/449 Node tests**, Chromium and WebKit passed; 518 native game configurations, 169 cache entries, exact Sol replay 100,000 visits/190 walk-forward checkpoints/1,000 stationary series and 83,391 legal paths. Mid-session readiness and resume probes passed in both browsers. This is the fully verified fallback.
- H4/H6: `site/v62-evidence.mjs` now requires the native Big Singles session date/start to agree with its recorded benchmark date, rejects a timestamp before session start or after the as-of day, and rejects fixed-game dates inconsistent with recorded timestamps. Genuine cross-midnight Big Singles may still be attributed to the session start day once the benchmark is available. Raw records are not rewritten. Direct execution of 15 targeted assertions against the fetched source (no assessment/checkout path exercised) produced **5/15 on 30ed82f and 15/15 on a3c5df4**. Tests added to audit-remediation suite; full new-SHA CI not yet established.
- Date consistency uses current browser local timezone; travelling or changing device timezone can exclude otherwise genuine old native records from the derived coaching dataset. Legacy Big Singles without a timestamp are still accepted when the original native session identity and start chronology agree; exact completion time is unknown. Arbitrary local JSON is not authenticated and cannot be made tamper-proof solely by field validation. Sol should review native provenance coverage and timezone migration before declaring H4/H6 closed.
- Offline worker cache generation advanced to dev5 for the source changes. Full new-SHA verification and independent re-audit remain release gates. No merge or publication authorised.

### Independent follow-up, 26 November 2026

Incoming 3f30332 failed run 45884742547 at the Node stage (449/450 locally).
The mirror/deletion fixture lacked native session start and date. Repaired
the fixture and retained the strict negative chronology tests. New native
session starts, Big Singles completions, game results and assessment completions
carry their event-time UTC offset for fixed evidence projection across travel.
Legacy timestamps still use the reader timezone; no offset is invented.
Chromium quota injection at finishSession(false) reproduced a false saved
confirmation. Completion now reports the primary write outcome, preserves
in-memory export and checkpoints only after success. A browser regression
uses a fresh profile and an injected primary-only QuotaExceededError.
The original independent tournament-in-ten-days question was unsupported,
and reported comparisons printed a regular expression as part of the skill
name. Bounded dated preparation previews are read-only, respect wellbeing
and do not register an event. Targeted Node suite passed 29/29.

The second pass reproduced a retention preview and save with zero delivered
sessions through tests/coach-integration.test.mjs. Numerical retention remains
an observational calculation. Linked intervention previews, saves and audit
counts now require the same attributable allocation as learning. Three distinct
matching days enable the save; absent delivery preserves historic raw records
without endorsing them. Duplicate donor/recipient names and impossible elapsed
time also disqualify attribution. The former empty-host positive fixture now
tests both the negative case and a full three-session positive case.

A third Chromium probe injected a primary-only write failure after a valid
checkpoint. The durable primary was intact but the recovery fence advanced,
disabling the last good checkpoint. Roll back only this writer's pending
fence when the stored primary still exactly matches the loaded value.
If rollback itself fails, recovery remains fenced. A browser test corrupts
the prior primary after the failed save and recovers its committed contents.

### Continued development without independent Sol availability

- Incoming `e3bd2f844b05cf48c903c2c7e9ed70d139931659` (153 commits) passed 452/452 Node tests but failed Chromium at the personalised-drill consent assertion. Enhanced the probe to verify the exact confirmation and expose actual write state instead of weakening the assertion. At `4dd7242ec1b2ec98954245341dc0af1e5329230e`, Actions run 45907521724 passed **453/453 Node tests and both Chromium/WebKit browser suites**; 518 native configurations, all 169 cache entries and readiness/recovery probes passed. The consent failure was not reproduced; root cause is not established. This is the newer verified fallback.
- H4: `robustTrend` previously checked mixed protocols/skills/contexts before excluding future rows. Direct paired execution against e3bd2f8 and ba5dd2c found 0/6 versus 6/6 correct historical comparisons (future incompatible records prepended and appended). Regression passed at the verified fallback.
- Coaching reasoning: long-window concerns vetoed by contradictory evidence or prior intervention were discarded when absent from the shorter comparison. Preserve them as investigation without creating a new focus. Added a conflicting practice/competition regression. Full later-SHA verification pending.
- Additional direct held-out trend-component simulations at ba5dd2c: 2,400 series, eight cohorts of 300, with variable 15/30/60/90-dart denominators and 15–45% missing days. Stable beginner 0/300 flags; stable elite 0/300; strongly correlated elite (.96) 20/300 flags; missing stable 0/300. Eight-point decline detected 20/300; 18-point decline 223/300; gradual 16-point improvement across 56 days 13/300; recovered slump 1/300 improving and zero declining. These are trend-component results, not full decision-layer sensitivities. Persisted as `tests/serial-calibration.test.mjs`. Mild/gradual sensitivity and strongly correlated elite form remain research priorities; do not simply reduce intervention thresholds.
- New `tests/five-year-player-cohorts.test.mjs` models 11 synthetic ability profiles, four fixed skills, irregular practice, injury, equipment change, slump and recovery, with 66 horizon checkpoints and separate injury checks. Tests compare retrospective full reports and precision settings, conserved session time, distinct abilities and read-only memory. A direct attempt to execute the complete module graph exceeded the connector call limit; rely on the actual Node workflow, not an assumed pass. Simulated scoring mixtures are simplified discrete dart outcomes, not realistic mechanical player models; this suite does not execute native daily games for five years.
- Offline generation dev9 covers revised reasoning sources. All later changes need fresh exact-SHA verification. No independent score or publication claimed.

### Five-year verification and advisory early-warning development

- Fully verified fallback `f847c286ec61e26f582bdfa78515423d3c29a10b`, Actions run 45907868765: **456/456 Node tests**, both browser suites passed, 169 offline cache entries. The five-year cohort test passed at e688a26 and f847c28. Eleven profiles generated 12,831 practice days and 51,324 fixed measurements, with 66 successful horizon comparisons and separate injury checks. The nominal 85-average mixed profile had supported doubles 20.4%, versus 37.1% for the nominal 75-average profile, producing different doubles selections. These are generated inputs and walk-forward checks, not closed-loop five-year actual play or evidence of training efficacy.
- New `earlyWarning` in `site/engine/context.mjs` is a diagnostic-only weekly comparison. Four disjoint weeks per period, at least three adequate weeks each, both latest weeks adequate, recent measurement within three days, at least three supporting lower weeks and lower latest three measured days. A five-percentage-point (three scoring average point) minimum and a weekly dispersion margin are engineering heuristics, not calibrated error probabilities.
- Candidate design was explored on the prior seed; separate direct holdout seed 0x4f69d1a7 with 10 cohorts of 500 and variable 15–90 attempts produced the following **declining robustTrend / advisory watch / either** counts. Only the trend component is compared; neither column proves actual intervention eligibility.

| Synthetic scenario | Declining trend | Advisory watch | Either |
| --- | ---: | ---: | ---: |
| Stable beginner | 3 | 13 | 13 |
| Stable elite | 0 | 17 | 17 |
| Strongly correlated elite | 13 | 68 | 68 |
| Mild 8pp decline | 38 | 229 | 229 |
| Severe 18pp decline | 376 | 494 | 495 |
| Gradual improvement | 0 | 1 | 1 |
| Recovered slump | 0 | 0 | 0 |
| Missing stable | 3 | 24 | 24 |
| Gradual decline | 43 | 245 | 246 |
| Recent 14-day decline | 7 | 109 | 109 |

The highly correlated null produced 13.6% advisory false flags (versus 2.6% declining-trend flags); missing stable had 179/500 insufficient screens. These are material limitations, not permission to loosen the confirmed-decline or allocation gate. No proof of optimal clinical or coaching sensitivity. Multi-scope family-wise false-warning probability is not controlled by merely limiting displays.
- Integrate the screen in fixed-benchmark development profile, agenda, recovery guidance and proactive coach only after verified report. Do not add it to the confirmed decision, native allocator or difficulty adjustment path. Show at most one advisory watch per action agenda; safety, existing intervention reviews and near-event brief take precedence. The selection tie-break is deterministic, not a validated utility model. User advice is repeat the same benchmark in normal practice, not increase dose, change equipment or rebuild technique.
- Direct deterministic fixture: recurring daily variation with 6.67pp lower weekly means was watch despite both short and long trend unclear; last-three-day recovery removed watch. Added four integration/calibration tests in `tests/early-warning.test.mjs`; fresh complete CI pending. Cache generation advanced to dev10. Original release remains unchanged.
