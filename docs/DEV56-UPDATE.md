# Dev56 update system

Base: e151deda3bf02d67ef1a96efbefa9dd541e4d13f (Dev55). Scope: in-place updates only.

Settings → Check for Updates → Install Update. The waiting worker verifies its cached shell version and inventory and requires a single app window. The page requires exclusive writer access, no active training/assessment, successful save and recovery checkpoint. It blocks interaction and reloads on controller change. No player storage keys are renamed or deleted.

Dev55 does not contain this button: initial delivery uses normal activation after closing all old app windows. Close, do not remove the home-screen app. Keep an external backup. Future releases must increment visible version and cache generation together. Real iPhone acceptance remains necessary.

CI: existing release/browser tests and tests/dev56-updates.test.mjs. Live acceptance: verify Pages shell title, worker generation, installed Settings version and exercise an in-place upgrade with saved player data, interrupted download, multiple app windows and offline reopen.
