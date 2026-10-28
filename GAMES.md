# Games in this project

This file keeps the games apart so nobody (person or AI chat) mixes them up.
Read it before changing anything.

## 1. Spade Haven (LIVE — do not break)

Four-player partnership **Spades**. Live at https://play.sedigitaltransformation.com,
on Render (auto-deploys from `main`), also in the Microsoft Store.

Spades-only files (the rules and bots of Spades):
- `shared/engine.ts` — Spades rules, bidding (Nil, Blind Nil), tricks, scoring, `GameState`
- `shared/bot.ts` — Spades bots (medium / high / expert, look-ahead for big bets)
- `shared/runtime.ts` — runs one Spades table (server and offline), seats, timers, bot fill
- `src/screens/Table.tsx` — the Spades table screen and bidding UI
- `src/components/SpadesBroken.tsx`, `CityRing.tsx` and the Ring/City artwork

Shared by every game (change with care — it affects the live game):
- accounts, sign-in, guests, email, profiles (`server/auth.ts`, `server/accounts.ts`, `src/lib/auth.ts`)
- coins, payments, Stripe, products (`server/payments.ts`, `shared/products.ts`)
- leaderboards, friends, referrals, chat (`server/leaderboard.ts`, `friends.ts`, `referrals.ts`, `shared/chat.ts`)
- lobby shell, avatars and bot pictures (`src/screens/Lobby.tsx`, `src/components/avatars.tsx`, `shared/botphotos.ts`)
- the websocket server and protocol (`server/index.ts`, `shared/protocol.ts`)
- legal pages, sign-in screen, site pages, Cloudflare/Render setup

## 2. Second game: Crows Haven (PLANNED — not started)

A four-player **partnership trick-taking game with bidding, a trump-suit choice and a
"nest" of extra cards** — in the style of the classic game Rook, but with its own name,
its own rules text and its own card art.

Working name: **Crows Haven** (chosen by the owner; the rook is a kind of crow, and "crow's nest" echoes the nest of extra cards).

Naming: do NOT call it "Rook" (or "Rook Haven") and do not copy the original game's deck or branding
(the name and deck are commercially owned). Before launch, search the trademark database
for "Crows Haven" (also "Crow Haven" and "Haven") and have a lawyer confirm; this file is not legal advice.

Rules to settle with the owner BEFORE coding (write the decisions here):
- deck (standard 52 cards or a custom deck), number of cards, point cards
- bidding range and who bids first
- nest: size, who takes it, how many cards are discarded
- how trump is chosen
- scoring target (for example 500) and what happens when a bid fails
- bots: how they bid, pick trump and use the nest

How to build it without touching Spades:
- work on the `second-game` branch only; merge to `main` only when the owner says so
- put everything new in its own files, for example `shared/<newgame>/engine.ts`, `shared/<newgame>/bot.ts`,
  `src/screens/<NewGame>Table.tsx`
- reuse the shared parts above; if a shared file must change, keep Spades behaving exactly as before
- add a "game" choice to the lobby and the table protocol, with Spades as the default
- run the existing checks and test a full Spades game before every merge

## Working rules for any chat
- Say which game you mean ("Spades" or "Crows Haven") in every request.
- Never paste Stripe keys, Upstash tokens, the Resend key or webhook secrets into chat or files.
- Anything that wipes data needs the owner's explicit confirmation.
- Do not use screenshots of robots or dolls as avatars. No fake leaderboard players.
