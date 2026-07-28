# Lamma Product-Readiness Implementation Plan

## Task 1: Multiplayer permission model

- Add failing reducer tests for non-host eligible controls, non-host next-round, active-team controls, duplicate/stale actions, and preserved secret privacy.
- Replace blanket host checks with action-specific authorization helpers.
- Publish the minimum public control context required by clients.
- Run focused room reducer and privacy tests.

## Task 2: Named sides and clear scores

- Add failing tests for two-player names, multi-player localized side labels, membership, active-side highlighting, and score changes.
- Extend timed-game state with stable side metadata.
- Update room UI to render one relevant scoreboard with names and round deltas.
- Run focused reducer/component tests.

## Task 3: Categorized content model

- Add failing schema/completeness/selection tests.
- Add shared category definitions and category IDs to prompt records.
- Curate recognizable bilingual Who Am I packs, including respectful Prophets, Seerah/Companions, and Quran themes/stories packs.
- Add applicable category selection to local and room setup, preserving selected IDs through room initialization.
- Run content and game-engine tests.

## Task 4: Lamma identity and generated artwork

- Generate the Lamma logo concept and eight text-free game covers with GPT Image 2.
- Save final assets under `public/brand` and `public/games`.
- Implement the Lamma palette, typography, brand header, tactile game cards, game-specific accents, and accessible reduced-motion behavior.
- Update metadata, manifest, icons, install labels, and share copy.
- Add static metadata/catalog tests.

## Task 5: Invite and canonical-domain behavior

- Add failing invite/share tests.
- Generate canonical `lamma.rainomotion.com` room links while supporting the current host during rollout.
- Add Web Share and copy fallback UI.
- Preserve room query/deep-link compatibility.

## Task 6: Verification and deployment

- Run all unit/integration tests and production build.
- Run mobile QA in Arabic and English at 360×800 and 390×844.
- Run two-browser acceptance covering guest progression and named two-player scoring.
- Request code review and resolve all critical/important findings.
- Deploy through the existing Coolify application, add the Lamma subdomain, and verify HTTPS, health, metadata, invite links, and an end-to-end room.

