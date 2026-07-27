# Bilingual Party Games Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Bara into a polished bilingual web platform containing eight complete group games, local and room-code play, and app-ready shared TypeScript contracts.

**Architecture:** A framework-independent `src/games` domain owns localized content, scoring, selection, timers, and room-safe state. Small React screens render a library and one controller per game. A versioned room API and shared contract keep browser and future mobile clients compatible; local mode never depends on that API.

**Tech Stack:** Next.js 15 static/mobile web client, React 19, TypeScript, Vitest, Playwright/Chromium QA, lucide-react, localStorage. Room service: Next.js server routes with a small persistent SQLite-compatible repository and polling/SSE transport when deployed as a server.

---

## File Map

- `src/games/types.ts`: shared locale, game, player, team, prompt, and scoring types.
- `src/games/catalog.ts`: eight-game metadata used by the library.
- `src/games/content/*.ts`: bilingual curated packs, one file per content-heavy game.
- `src/games/engines/*.ts`: pure scoring, selection, timer, voting, and role functions.
- `src/components/GameLibrary.tsx`: home/library and play-mode selection.
- `src/components/SetupShell.tsx`: reusable players, teams, categories, and duration setup.
- `src/components/games/*.tsx`: independent local game controllers.
- `src/rooms/contracts.ts`: versioned request/event/player-safe payload contracts.
- `src/rooms/repository.ts`: room lifecycle and state transitions behind an interface.
- `src/app/api/rooms/**/route.ts`: create, join, state, and action HTTP endpoints.
- `src/app/page.tsx`: top-level locale/navigation/session coordinator only.
- `src/app/globals.css`: responsive visual system and game-board layouts.
- `public/manifest.webmanifest`, `public/icons/*`: installable PWA metadata.
- `tests/*.test.ts`: pure domain and contract tests.
- `tests/mobile-qa.mjs`: bilingual mobile and overflow browser QA.

### Task 1: Shared Types and Game Catalog

**Files:**
- Create: `src/games/types.ts`
- Create: `src/games/catalog.ts`
- Test: `tests/catalog.test.ts`

- [ ] **Step 1: Write failing catalog tests**

```ts
import { describe, expect, it } from "vitest";
import { GAME_CATALOG } from "../src/games/catalog";

describe("game catalog", () => {
  it("contains eight uniquely identified bilingual games", () => {
    expect(GAME_CATALOG).toHaveLength(8);
    expect(new Set(GAME_CATALOG.map((game) => game.id)).size).toBe(8);
    for (const game of GAME_CATALOG) {
      expect(game.title.ar.length).toBeGreaterThan(0);
      expect(game.title.en.length).toBeGreaterThan(0);
      expect(game.description.ar.length).toBeGreaterThan(0);
      expect(game.description.en.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run `npm test -- tests/catalog.test.ts` and verify failure because the catalog does not exist**
- [ ] **Step 3: Implement `LocalizedText`, `GameId`, `PlayMode`, and `GameDefinition` types and eight catalog entries: category challenge, out of the loop, charades, forbidden word, who am I, rapid fire, most likely to, and two truths and a lie**
- [ ] **Step 4: Run the catalog test and full `npm test`; expect all tests to pass**
- [ ] **Step 5: Commit with `feat: add bilingual party game catalog`**

### Task 2: Category Challenge Domain and Content

**Files:**
- Create: `src/games/content/categoryChallenge.ts`
- Create: `src/games/engines/categoryChallenge.ts`
- Test: `tests/category-challenge.test.ts`

- [ ] **Step 1: Write failing tests proving six selectable categories, five unique 100–500 questions per board category, no repeats, and immutable score changes**
- [ ] **Step 2: Run the focused test and confirm missing-module failure**
- [ ] **Step 3: Add at least eight bilingual categories with ten questions each and implement `buildBoard`, `answerQuestion`, and `adjustTeamScore` pure functions**
- [ ] **Step 4: Run focused and full tests; expect pass**
- [ ] **Step 5: Commit with `feat: add category challenge engine and question bank`**

### Task 3: Remaining Game Engines and Curated Packs

**Files:**
- Create: `src/games/content/actionGames.ts`
- Create: `src/games/content/socialGames.ts`
- Create: `src/games/engines/actionGames.ts`
- Create: `src/games/engines/socialGames.ts`
- Test: `tests/party-engines.test.ts`

- [ ] **Step 1: Write failing tests for non-repeating prompt decks, charades scoring, forbidden-word violations, private identity assignment, rapid-fire scoring, vote tally/ties, and two-truths reveal**
- [ ] **Step 2: Run the focused test and confirm missing-module failures**
- [ ] **Step 3: Add at least 60 bilingual prompts per action game, 40 bilingual social prompts, and pure deterministic engines accepting an injected random function**
- [ ] **Step 4: Run focused and full tests; expect pass**
- [ ] **Step 5: Commit with `feat: add six party game engines and bilingual packs`**

### Task 4: Library, Navigation, and Shared Setup UI

**Files:**
- Create: `src/components/GameLibrary.tsx`
- Create: `src/components/SetupShell.tsx`
- Create: `src/components/TopBar.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/ui-state.test.ts`

- [ ] **Step 1: Write failing tests for localized library labels, supported player ranges, locale persistence helpers, and setup validation**
- [ ] **Step 2: Run tests and verify missing helpers**
- [ ] **Step 3: Implement a premium responsive library, language switch, one-device/room selector, reusable setup primitives, and top-level navigation; keep `page.tsx` as a coordinator**
- [ ] **Step 4: Run unit tests and `npm run build`; expect pass**
- [ ] **Step 5: Commit with `feat: build bilingual game library and shared setup`**

### Task 5: Category Challenge One-Device Experience

**Files:**
- Create: `src/components/games/CategoryChallenge.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/category-ui-state.test.ts`

- [ ] **Step 1: Write failing state tests for category selection, team naming, question locking, answer reveal, timer timestamps, positive/negative scoring, and winner selection**
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement setup, 6×5 board, question modal, 30-second timer, answer reveal, score controls, locked cells, and final result**
- [ ] **Step 4: Run tests and build; expect pass**
- [ ] **Step 5: Commit with `feat: add complete category challenge game`**

### Task 6: Action Games UI

**Files:**
- Create: `src/components/games/Charades.tsx`
- Create: `src/components/games/ForbiddenWord.tsx`
- Create: `src/components/games/WhoAmI.tsx`
- Create: `src/components/games/RapidFire.tsx`
- Create: `src/components/games/TimedRound.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add component-state tests covering start, correct, skip, violation, pass-device privacy, timer expiry, next team, and final score**
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement the four complete game flows using the shared `TimedRound` and domain engines**
- [ ] **Step 4: Run tests and build; expect pass**
- [ ] **Step 5: Commit with `feat: add four timed and identity party games`**

### Task 7: Social Games UI and Existing Game Migration

**Files:**
- Create: `src/components/games/MostLikelyTo.tsx`
- Create: `src/components/games/TwoTruthsLie.tsx`
- Move: `src/lib/game.ts` responsibilities into `src/games/engines/outOfLoop.ts` and `src/games/content/outOfLoop.ts`
- Create: `src/components/games/OutOfLoop.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/out-of-loop.test.ts`

- [ ] **Step 1: Preserve existing five tests and add tests for private voting, ties, statement validation, and reveal state**
- [ ] **Step 2: Run the expanded suite and verify new tests fail**
- [ ] **Step 3: Split and migrate the existing game without changing behavior, then implement both social games**
- [ ] **Step 4: Run tests and build; expect pass**
- [ ] **Step 5: Commit with `feat: complete social games and migrate out of loop`**

### Task 8: Versioned Room Contracts and Repository

**Files:**
- Create: `src/rooms/contracts.ts`
- Create: `src/rooms/repository.ts`
- Create: `src/rooms/playerView.ts`
- Test: `tests/rooms.test.ts`

- [ ] **Step 1: Write failing tests for six-character codes, host/player tokens, join limits, expiry, host-only actions, reconnection, and removal of other players' private data**
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement `RoomRepository` with create/join/get/applyAction/expire methods and `toPlayerView(room, playerToken)` privacy projection**
- [ ] **Step 4: Run focused and full tests; expect pass**
- [ ] **Step 5: Commit with `feat: add app-ready room contracts and secure state repository`**

### Task 9: Room API and Browser Room Client

**Files:**
- Create: `src/app/api/rooms/route.ts`
- Create: `src/app/api/rooms/[code]/join/route.ts`
- Create: `src/app/api/rooms/[code]/state/route.ts`
- Create: `src/app/api/rooms/[code]/action/route.ts`
- Create: `src/rooms/client.ts`
- Create: `src/components/RoomLobby.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/room-api.test.ts`

- [ ] **Step 1: Write failing API tests for create, join, invalid/expired code, authorized state, host actions, and player-safe payloads**
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement versioned JSON endpoints, polling/reconnect client, create/join forms, lobby, share link, and localized recovery states**
- [ ] **Step 4: Run tests and a two-browser manual room smoke test; expect synchronized lobby and safe private payloads**
- [ ] **Step 5: Commit with `feat: add room-code multiplayer service and lobby`**

### Task 10: PWA, Accessibility, and Mobile QA

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon.svg`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/mobile-qa.mjs`

- [ ] **Step 1: Extend mobile QA to open every game at 360×800 and 390×844 in both languages and assert no horizontal overflow, visible primary controls, and correct `dir`**
- [ ] **Step 2: Run QA and record failing screens**
- [ ] **Step 3: Add manifest, theme metadata, install icon, focus-visible states, reduced-motion handling, safe-area padding, and targeted responsive fixes**
- [ ] **Step 4: Run `npm test`, `npm run build`, and `npm run test:mobile`; expect all pass**
- [ ] **Step 5: Commit with `feat: make party platform installable and mobile accessible`**

### Task 11: Production Integration and Deployment

**Files:**
- Modify: `Dockerfile`
- Modify: `next.config.mjs`
- Modify: deployment configuration only as required by the existing Coolify application

- [ ] **Step 1: Change deployment from static-only export to a Next.js server build so room routes can execute, while preserving port 80/health behavior**
- [ ] **Step 2: Run a local production container and verify `/`, `/manifest.webmanifest`, and `/api/rooms`**
- [ ] **Step 3: Run the complete verification suite and inspect Arabic/English screenshots**
- [ ] **Step 4: Merge the feature branch, push the exact verified commit, deploy the existing Coolify app, and wait for a healthy terminal status**
- [ ] **Step 5: Verify HTTPS 200, one-device gameplay, two-device room join/sync, and mobile layout on `https://bara.rainomotion.com`**
- [ ] **Step 6: Commit any deployment-only fixes with `fix: finalize party platform production deployment`**
