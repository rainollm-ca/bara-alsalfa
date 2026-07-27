# Bilingual Party Games Platform Design

## Goal

Expand `bara.rainomotion.com` from one pass-the-phone game into a bilingual Arabic/English party-games platform. The web app remains fully usable on phones and desktops, while shared game logic and room APIs are designed for reuse by a future iOS/Android app.

## Product Shape

The landing screen is a game library rather than a single-game introduction. Players choose Arabic or English, select a game, then choose one of two play modes:

- **One device:** the host passes one phone or controls the shared screen. This mode requires no account or network room.
- **Room code:** a host creates a short-lived room and other players join from their phones using a short code or shareable link.

Language, recent player names, team names, and accessibility preferences are stored locally. No account is required for the initial release.

## Initial Game Library

### Category Challenge

Two teams compete on a board of categories selected before play. Each category has five questions worth 100, 200, 300, 400, or 500 points. The host reveals a question, starts or pauses the timer, reveals the answer, and awards or removes points. Used questions remain visibly locked. The final screen shows both scores and the winning team.

The first release includes a substantial curated Arabic and English question bank. Arabic and English are parallel localized content, not automatic browser translation. Categories can be enabled or disabled before creating the board.

### Out of the Loop

Preserve the existing game with its current private role reveal, category selection, voting, and bilingual content. It becomes one card in the library.

### Charades

Teams take turns acting out randomly drawn prompts before the timer expires. The host marks each prompt correct, skipped, or failed. Scores accumulate by round.

### Forbidden Word

A player describes a target without saying its listed forbidden words. The opposing team can mark a violation. Correct answers and violations affect the round score.

### Who Am I?

Each player receives a hidden identity that everyone else can see. The device provides pass-and-reveal privacy in one-device mode; room mode sends each identity to the appropriate participant views.

### Rapid Fire

A team answers as many short prompts as possible in 60 seconds. Correct and skipped controls advance immediately and preserve a round summary.

### Most Likely To

The app presents group-vote prompts. Players vote privately in room mode or together in one-device mode, then the result is revealed.

### Two Truths and a Lie

Each participant enters three statements. The other players vote for the lie, followed by a reveal and round result.

## Architecture

### Shared Domain

Game definitions, localization types, scoring rules, timers, question selection, and round state live in framework-independent TypeScript modules. UI components consume those modules through typed game controllers. This allows a future React Native/Expo application to reuse game logic and content without copying rules.

### Web Client

Continue with Next.js and responsive React. The interface is mobile-first, supports RTL/LTR at the document and component levels, and can be installed as a PWA. Local-only games work without a room service after initial load.

### Room Service

Room play uses a small authenticated-by-code service with server-authoritative state and real-time updates. A room has a host token, join code, player tokens, selected game, locale, and current state. Rooms expire automatically after inactivity. The service exposes versioned HTTP endpoints and a real-time channel so the future mobile app can join the same rooms.

No private game state is broadcast to unauthorized players. Hidden roles and identities are delivered only to the intended participant or host view.

## Navigation and Visual Direction

The existing visual identity evolves into a warm, premium game-night aesthetic. The home page prioritizes clear game cards, player-count badges, duration, and play-mode support. Setup uses short step-based screens rather than dense forms. During play, controls remain thumb-accessible and scores/timers stay visible.

Every screen targets 360px-wide phones first, then scales to tablets and desktop shared displays. Arabic copy uses natural RTL layouts rather than mirrored English spacing.

## Content Model

Every game pack has:

- Stable game, category, prompt, and question IDs.
- Arabic and English titles, instructions, prompts, answers, and hints.
- Difficulty or point value where applicable.
- Optional age/sensitivity metadata for future family filters.

Question selection avoids repeats within a session. The platform ships curated built-in packs; custom user-authored packs are outside this initial release.

## Reliability and Error Handling

- Local mode remains playable when room networking is unavailable.
- Room clients reconnect and request the current authoritative state.
- The host can reclaim a room using its local host token.
- Invalid/expired codes produce a clear localized recovery screen.
- Refreshing a game restores the active local session when safe.
- Timer state uses timestamps rather than relying only on browser intervals.

## Testing and Acceptance

- Unit tests cover scoring, question selection, timers, role privacy, localization completeness, and room state transitions.
- Integration tests cover creating/joining rooms, reconnecting, host controls, and private player payloads.
- Browser tests cover the complete flow of each game in Arabic and English.
- Mobile QA covers at least 360×800 and 390×844 with no horizontal overflow.
- Production acceptance requires a successful build, live HTTPS health check, and real multi-device room test.

## Delivery Sequence

1. Refactor the existing game into a game-library shell and shared domain structure.
2. Build Category Challenge completely in one-device mode.
3. Add the other six local games.
4. Add room service and connect supported multiplayer flows.
5. Add PWA metadata/offline shell, run bilingual mobile QA, and deploy.

The web release is the source implementation. A future mobile app consumes the same versioned room contract and ports or packages the shared TypeScript domain modules.
