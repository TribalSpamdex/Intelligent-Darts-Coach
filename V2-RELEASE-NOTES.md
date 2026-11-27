# IDC V2.0 personal-use release — 2026-11-27

Production URL: https://tribalspamdex.github.io/Intelligent-Darts-Coach/site/index.html

- Exact audited runtime: b36a310b1c0a334debc5ddb2839a6785d1601f2e, site tree 71b6dc1cbee02af146d8db89628cd54814269b25.
- 499/499 Node tests and mandatory Chromium/WebKit passed at 4143ab523c20757fe44d34adbca7de35dabf0e9a, Actions run 45977836340.
- 22/22 user-reported iPhone acceptance checks, including upgrade, offline gameplay, backup restoration, and original app unaffected. See V2-RELEASE-ACCEPTANCE.md.
- V1.9.0 previous production preserved on archive/v1.9.0-dev at 112660157bbd84a794ae423cf671878f2392c809. Original V6.2 repository untouched.
- No runtime changes for promotion. The internal version label remains V2.0.0-dev, not Update B. The separate preview remains accessible for the user's test data but must stay in a separate Safari profile. Production and preview on the same origin share storage/cache namespaces if opened in the same profile; do not do this. Export backups before opening production, and do not clear website data. Do not restore a disposable test backup over genuine production history.
- Production hosting availability and an actual older-production-profile migration are not yet confirmed by the device acceptance tests. The WebKit artificial offline diagnostic remains unresolved despite successful mandatory browser and physical offline tests. Long-term improvement and commercial licensing are not established.
