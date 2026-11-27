# DEV54 independent audit remediation

Baseline: `b69596969c24829a7603475331383eef78a75ba3` (DEV53).

An asynchronous archive save previously captured its comparison generation only after hashing. A later delete or faster save could finish during hashing and then be silently undone. DEV54 captures an optimistic revision before hashing; both atomic rotation and deletion advance that revision. The deletion tombstone contains only a counter. Existing v1 archive envelopes and both generations retain their format; the primary player store is unchanged. A conflicting pending save fails explicitly and requires a fresh user action.

Current-condition forecasts and measured native drill preferences now share the existing validated current-reference boundary used by the adaptive profile. Quick Play now applies the same assessment validation: version 6, completed, genuine assessment, known completion date no later than the review date and wall clock. Future and unsupported assessments cannot suppress historical Quick Play evidence.

Independent regressions demonstrate four baseline Node failures and four real cross-tab IndexedDB failures. The same tests pass on the candidate. Browser CI includes those races and an additional actual pinned DEV53-to-DEV54 service-worker upgrade, retaining all older upgrade cases and original feature assertions.

The change does not migrate primary storage, establish human coaching efficacy, add a knowledge licence, or certify physical iOS Safari. Release review requires exact-head CI and owner device acceptance. Full evidence and ranked development recommendations are delivered separately.
