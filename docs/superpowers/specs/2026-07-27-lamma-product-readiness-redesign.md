# Lamma Product-Readiness Redesign

## Decision

Rebrand the platform as **Lamma | لمّة** and move the canonical web experience to `lamma.rainomotion.com`. “Lamma” expresses gathering in Arabic, is easy to pronounce in English, and supports a broader library than the original single-game name. The old `bara.rainomotion.com` address remains a compatible entry point during the transition.

## Product Goal

Turn the current bilingual party-games website into a polished, fair, app-ready multiplayer product. The release must correct the real two-device play problems Rabiaa observed, make every game understandable without explanation, provide culturally appropriate categorized content, and establish a distinctive visual brand reusable by future iOS and Android apps.

## Multiplayer Fairness and Control

- Every connected player sees the public game, active player, active side, roster, round, timer, and public scores at the same time.
- Any eligible participant may progress public gameplay. The host retains administrative controls such as starting a game, changing the selected game, removing a player, or returning the whole room to the lobby.
- Category Challenge scoring can be recorded by any connected player.
- Charades, Forbidden Word, and Rapid Fire controls are available to the active actor and their active teammates. With exactly two players, both participants may mark answers and advance so the answerer is never blocked by the other device.
- End-of-round “Next round” is available to all participants; the server remains authoritative and rejects duplicate/stale transitions.
- Secret material remains private. Public controls do not imply access to hidden prompts, identities, or roles.
- Action permissions are explicit domain rules rather than a blanket `isHost` check.

## Scoring and Team Labels

- The room state publishes team display names and membership, not only `team-1` and `team-2` identifiers.
- With two players, each side is labelled with the player's actual name.
- With three or more players, sides use localized Team 1 / Team 2 names and show their member names underneath.
- The active side is highlighted consistently on every device.
- Player-score games and team-score games never show both score systems without explanation.
- Round summaries state who scored, what changed, and the cumulative total.

## Categorized Content

All reusable prompts gain a stable `categoryId`. Setup allows one or more content packs to be selected before play. Selection is preserved for the session and enforced server-side.

Initial cross-game taxonomy:

- Everyday life
- Food and places
- Animals and nature
- Sports
- Science and technology
- Professions
- World-famous people
- Arab-world figures
- Prophets and messengers
- Seerah and companions
- Quran themes and stories
- Family-friendly fun

Islamic content is respectful and factual. It avoids visual depictions of prophets, speculative claims, sectarian disputes, sacred-text impersonation, and scoring mechanics that trivialize Quran verses. Questions focus on names, places, events, values, themes, and well-established stories, with Arabic and English localization.

“Who Am I?” prioritizes recognizable identities and lets players select packs. Obscure Western names are removed from the default mixed pack. Out of the Loop, Charades, Forbidden Word, Rapid Fire, Most Likely To, and Category Challenge expose relevant category filters using the same category vocabulary where practical.

## Brand and Visual System

### Name

- Arabic: **لمّة**
- English: **Lamma**
- Descriptor: “Play together” / “اللعب يجمعنا”
- Canonical domain: `lamma.rainomotion.com`

### Visual Direction

Lamma uses a joyful editorial game-night identity rather than generic gradients:

- Midnight indigo `#211A4A`
- Electric coral `#FF6B61`
- Saffron `#FFC857`
- Fresh mint `#46D7B8`
- Warm cream `#FFF8ED`
- Ink `#17142C`

The interface uses bold bilingual typography, layered paper/card shapes, tactile buttons, clear hierarchy, and restrained motion. Arabic and English layouts are independently balanced.

### Logo

The primary mark is a compact gathering symbol: four rounded playing-card/speech shapes converging around a spark. It must work as a square app icon, browser icon, and horizontal wordmark. Generated exploration is converted into production-safe web assets; small-size icon rendering is verified separately.

### Game Artwork

Each game receives a distinct illustrated cover with a shared art direction, palette, texture, and aspect ratio. Artwork is decorative and never carries essential instructions or generated text. The game title remains live HTML for accurate bilingual rendering and accessibility.

## Link and App Readiness

- Room invite links use the canonical Lamma domain and retain the room code.
- Native Web Share is used when available, with a copy-link fallback and localized confirmation.
- PWA metadata, icons, theme colors, Open Graph metadata, and install labels use Lamma.
- Shared game logic and content remain framework-independent TypeScript.
- Room contracts stay versioned. Permission and category fields are additive and documented for later React Native/Expo consumption.
- Deep links retain stable query parameters suitable for future universal/app links.

## Acceptance

- A non-host can advance an eligible two-device round.
- Two-player timed games show the two names as score labels and update the correct side.
- All devices show roster, active player/side, and public scores consistently.
- Hidden information is not leaked by the expanded control model.
- Who Am I and other applicable games allow category selection and use only the selected packs.
- Arabic/English content completeness tests cover all shipped categories.
- Lamma branding, logo, game covers, PWA metadata, and invite links appear in production.
- Full unit/integration suite, build, mobile visual QA, and a real two-browser room flow pass before deployment.

