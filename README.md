# Intelligent Darts Coach (IDC)

V1.0.0-dev: integrated comparison-mode candidate, not a production release.

- Training platform: exact V6.2 source at TribalSpamdex/darts-coach commit b248a1caa169c9a45a6beda3954dc067cbfbe6e1, with separate storage keys, new local Coach panel, share URL and offline asset cache.
- Independent engine: pinned V0.4.0 at TribalSpamdex/DCI-independent commit a39210419869ecf1160471997b10300d57c93ef1. The original engine regression suite is carried over.
- Adapter projects completed native assessment measurements, fixed scoring and bull rounds, and confirmed non-quick daily Big Singles into separate protocols. No synthetic results, unmeasured target aims, adaptive game conversions, or Quick Play. Missing or ambiguous measurements are excluded. Projection is rebuilt from the authoritative IDC training snapshot rather than appended, so corrections are reflected on the next review.
- Comparison mode is read-only: the V6.2 planner controls training; independent recommendations are advisory. The comparison currently shows legacy mastery decisions and new focus decisions, not a calibrated like-for-like efficacy evaluation.
- No original storage keys or original app source are modified. IDC has separate local storage. No automatic import of existing personal data. No separate persistent independent player profile or autonomous intervention control in this candidate.
- No LLM or paid runtime services. Actual player outcomes and iPhone tests remain necessary.

## Test
Run node --test tests/*.test.mjs and the Playwright browser smoke checks from the verification workflow. Publication requires successful checks and GitHub Pages configuration.
