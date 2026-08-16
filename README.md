# Instant Tournament Pairing

A Next.js app using Firebase Auth and Firestore that builds tournament brackets from office-day overlap and player rank, and also supports an open challenge ladder (Royale).

## Features

- Firebase Authentication (email only)
- Firestore backend
- Players choose their office days and optional global seed (lower is better)
- Two tournament types: **World Cup** and **Royale**
- Material UI
- TypeScript
- Ready for Vercel deployment

## Tournament types

### World Cup (groups + knockout)

Players are grouped by seed and office-day overlap, play a round-robin group stage, then a knockout. When the tournament is finalized, each player’s global seed is **adjusted** from their finish (champion improves, early exits worsen). Unseeded players receive a base seed from their finishing place.

### Royale (challenge ladder)

Royale is a squash-style challenge ladder, not a pre-generated bracket. Matches are created when someone challenges a player ranked above them. Standings are derived by replaying results, so editing a score recalculates the ladder correctly.

#### Starting ranks

- Players who already have a **global seed** start **ranked**, in seed order (seed 1 is top of the ladder).
- Players with no seed start **unranked**.
- A player becomes ranked only by beating a ranked player.

#### Who can challenge whom

- You may only challenge someone **ranked above you**.
- Unranked players may challenge any ranked player.
- Ranked players cannot challenge someone below them or another unranked player.
- After two players meet, they cannot rematch until **each** has completed matches against **two other distinct players**.
- At most one incomplete match is allowed per pair.

#### How results move the ladder (leapfrog)

These rules follow common squash / table-tennis challenge ladders:

- If a **higher-ranked** player beats a lower-ranked or unranked player, the ladder does **not** change. The favourite was expected to win.
- If a **lower-ranked or unranked** player B beats a **higher-ranked** player A, B **takes A’s position**. A drops one rank, and everyone who was between them (or below A, if B was unranked) also drops one rank.

Examples, starting from `Alice, Bob, Carol, Dave`:

- Dave (#4) beats Alice (#1) → `Dave, Alice, Bob, Carol`
- Unranked Eve beats Bob (#2) → `Alice, Eve, Bob, Carol, Dave` (Bob drops to #3; Eve is now ranked)

Unranked vs unranked does not rank anyone. Ranked vs unranked does not move the ladder if the ranked player wins.

#### Seeds after finalize

Royale uses the **same +/- seed adjustments as World Cup**, so one event does not rewrite the whole club ranking:

- Rank 1: −5 (improves)
- Rank 2: −2
- Rank 3: 0
- Rank 4: +2
- Rank 5: +4
- Rank 6: +6
- Rank 7 and below: +8 (capped, same as a World Cup group 4th)

Players who **already had a seed** keep it, plus that adjustment. Players who **started unranked and climbed onto the ladder** get a base seed from finishing place (same table as World Cup, capped at 12 for 7th and below). Players who **never beat a ranked player** stay unseeded.

Players who did not enter the tournament are left unchanged.

## Testing with dummy players

On the home page:

- **Seed World Cup** creates dummy players and a group-stage tournament (existing behaviour).
- **Seed Royale** creates a fresh set of dummy players (~60% uniquely seeded 1…k, the rest unranked) and an empty Royale tournament named “Seeded Royale Tournament”, so you can create challenges from scratch.

## Scripts

- `npm run dev` — development server
- `npm run build` / `npm start` — production
- `npm test` — unit tests in `tests/` (Royale ladder rules)
