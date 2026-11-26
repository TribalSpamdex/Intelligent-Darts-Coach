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
| M3 Correlated stationary false trends | Open | Re-run original stationary IID and AR tests, calibrate sensitivity/specificity without retrospective tuning |
| M4 Future linked gameplay | Match round date and activity timestamps | Regression and cross-midnight policy; ambiguous rounds deliberately excluded |
| M5 Legal misses before finishing dart | Exact finish validation admits missed darts before valid terminal double | Independent enumeration and browser input |
| M6 Competition preparation | Existing V2 calendar/brief and bounded advice | Integrated, competition-specific preparation and post-match evaluation |
| M7 Bounded dialogue | Additional read-only training, review, action and checkout paraphrases | Broader independent paraphrase coverage |
| Other | Retention checks consider equipment/technique change | Offline cache lifecycle, long-history performance, physical device, independent evidence review |

Verification: GitHub Actions is authoritative for the exact candidate SHA. Earlier red runs exposed obsolete test assumptions and missing fixture provenance; preserve stronger positive and negative assertions. No test pass count is inherited from a different commit.

Original V6.2 and live V1.9.0-dev must remain untouched until release gates pass. The eventual independent re-audit must reproduce all original findings using Sol's evidence archive.
