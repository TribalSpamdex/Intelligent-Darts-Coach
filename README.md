# Intelligent Darts Coach (IDC)

V1.1.0-dev: integrated coaching candidate, not a production release. V1.0.0-dev preserved on archive/v1.0.0-dev.

- Training platform: exact V6.2 source at TribalSpamdex/darts-coach commit b248a1caa169c9a45a6beda3954dc067cbfbe6e1, with separate storage keys, new local Coach panel, share URL and offline asset cache.
- Independent engine: pinned V0.4.0 at TribalSpamdex/DCI-independent commit a39210419869ecf1160471997b10300d57c93ef1. The original engine regression suite is carried over.
- Adapter projects completed native assessment measurements, fixed scoring and bull rounds, and confirmed non-quick daily Big Singles into separate protocols. No synthetic results, unmeasured target aims, adaptive game conversions, or Quick Play. Missing or ambiguous measurements are excluded. Projection is rebuilt from the authoritative IDC training snapshot rather than appended, so corrections are reflected on the next review.
- Persistent independent player facts, readiness, technical observations, equipment and intervention histories are stored inside the IDC player backup. Host observations and classified practice minutes are projected from saved records, not duplicated. Corrected or missing baseline measurements veto an accepted intervention. The independent engine may transfer five minutes within a scheduled session only when current evidence, explicit acceptance, unchanged baseline, existing workload protections, and absence of any competing legacy adjustment permit it. The legacy planner retains control otherwise. No change to game rules or levels.
- No original storage keys or original app source are modified. IDC has separate local storage. No automatic import of existing personal data. No automatic import of another app's personal data. The independent profile is included in IDC backups and is removed by IDC's reset. No cross-device or concurrent-window guarantee beyond the existing host storage design.
- No LLM or paid runtime services. Actual player outcomes and iPhone tests remain necessary.

## Test
Run node --test tests/*.test.mjs and the Playwright browser smoke checks from the verification workflow. Publication requires successful checks and GitHub Pages configuration.

## V1.1.0 limitations
Only known comparable benchmarks and unambiguous completed exercise minutes are projected. Target-dependent adaptive games are not pooled as fixed accuracy tests. The new coach can advise pausing normal scheduled training based on reported discomfort; Quick Play and assessments retain their original controls. If the independent engine is unavailable the legacy app continues unchanged. No full automatic diagnosis, unrestricted language model or scientific validation of training effectiveness. Allocation remains conservative and may be declined even after consent. The comparison is not a controlled effectiveness trial. The underlying engine is pinned at V0.4.0. Actual iPhone testing is required after publication.
