# V2.0 release acceptance record

## Pinned verified runtime

- Candidate: `b36a310b1c0a334debc5ddb2839a6785d1601f2e`
- Runtime tree from that candidate: unchanged by this evidence/test-only commit.
- Independent Sol audit return base: `38eefcdbd43c065873e0e5d58bfc98ec4b03ca65`.
- Successful workflow: https://github.com/TribalSpamdex/Intelligent-Darts-Coach/actions/runs/45974108572
- 497/497 Node regression tests. Both mandatory browser suites passed.
- Each Chromium and WebKit run: 41 native Quick Play games, 336 configurations including eight Target Mastery modes, 336 natural rounds, 5,944 matrix actions, plus targeted checkout/Bingo/Undo/background checks. Matrix predominantly uses misses; it is not exhaustive of all possible hit/miss paths. The matrix uses isolated in-memory save/render stubs; separate browser tests cover durable saves.
- Both browser engines passed failed precache, waiting-worker update, old-client consistency, new activation, HTTP outage, socket disconnection, cached Coach execution and profile survival.
- Both browser engines passed synthetic v2/v3 legacy migration, large Unicode compression, nine rejected restores, cancellation, simulated quota failure, interrupted-session clock and Undo recovery.
- Independent scoring oracles: 100,000 straight-in visits, 100,000 double-in visits, 507 checkout queries, 83,391 route paths, 211,455 native keypad checks. Session allocation: 5,000 initial plans and 43,212 remaining-clock cases.
- Static privacy inspection fetched every one of the 86 runtime files (1,353,162 bytes) at the pinned commit. The scan found no direct calls to common network transport APIs. External URLs were 31 source citations in the knowledge base and a user-initiated app share link. Static scanning is not a proof of absence of every possible transmission. Explicit sharing/export can disclose player-selected information to a destination chosen by the player; the hosting provider may receive ordinary page/asset requests. No paid inference dependency identified.
- WebKit Playwright network-emulation remains unresolved: Page.goto reports an internal browser error. This was explicitly separated from mandatory actual-origin HTTP and socket-disconnection checks, both of which passed. It is not a verified physical Safari airplane-mode result.

## Remaining human gates

The production website is unchanged. The candidate is suitable for controlled personal-device acceptance, not a claim of proven coaching effectiveness.

1. Obtain a controlled HTTPS deployment of the exact pinned runtime; use a separate test origin or fresh isolated profile, not a shared production storage namespace. Record the deployment commit and URL. Export a backup before touching an existing profile.
2. On the physical iPhone 15, open Safari; confirm the displayed candidate version, complete Quick Start and add to Home Screen. Close Safari and open the installed app.
3. Record a test training session, a Big Singles benchmark or short measured sample, and a Coach fact. Confirm the Coach, stats and original navigation remain usable at portrait size.
4. During a game, record a dart, background the app, wait, reopen it. Confirm timer paused, dart retained, Undo works after explicit resume, and the rules dialog does not auto-resume after backgrounding.
5. Export JSON and verify it is available in Files. Reload, check saved history, and restore the backup only in a disposable test profile. Verify the original V6.2 profile is unaffected.
6. Once initial assets are cached, enable airplane mode (Wi-Fi and cellular off), fully close and relaunch the installed app. Answer a checkout question and record a practice action. Reconnect and confirm both persist.
7. Verify a subsequent controlled update on the same installed device, including backup survival, new version, offline relaunch and no old/new mixed assets. Do not clear Safari data to make a failing test pass.
8. Record device model, iOS version, exact runtime, result and any screenshot/error. Do not declare stable production readiness until failures are resolved.

Repository metadata reports no license. The integrated V6.2 and independent-engine source provenance is documented in README, but commercial redistribution permissions are not established by this technical audit. Do not assume an open-source or commercial license from public GitHub access. Owner must confirm rights and choose licensing before commercial distribution. Real prospective player validation and a comparative coaching-effectiveness study remain outstanding; software tests and simulated trajectories do not establish superiority over a human coach or general-purpose AI.
