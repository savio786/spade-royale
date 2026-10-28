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

## 2. Second game: Crows Haven (rules settled — not coded yet)

A four-player **partnership trick-taking game with bidding, a trump-suit choice and a
"nest" of extra cards** — in the style of the classic game Rook, but with its own name,
its own rules text and its own card art.

Working name: **Crows Haven** (chosen by the owner; the rook is a kind of crow, and "crow's nest" echoes the nest of extra cards).

Naming: do NOT call it "Rook" (or "Rook Haven") and do not copy the original game's deck or branding
(the name and deck are commercially owned). Before launch, search the trademark database
for "Crows Haven" (also "Crow Haven" and "Haven") and have a lawyer confirm; this file is not legal advice.

### Rules (settled with the owner, 2026-10-27)

Crows Haven follows the **published Rook tournament rules** (the "official tournament"
version printed with the game), with our own deck art and names. Items marked *(default)*
are not spelled out in those rules; the owner can change them.

**Deck — 41 cards, our own design**
- Four coloured suits numbered **5 to 14** (40 cards) plus one **Crow** card (our bird card).
- Suit colours, card art and the Crow artwork are our own; no Rook logo, bird art or wording.
- Rank inside a suit: 14 high down to 5.

**Point cards (120 points in the deck)**
- each 5 = 5 · each 10 = 10 · each 14 = 10 · the Crow = 20

**Deal**
- 4 players, fixed partners sitting opposite (same seating as Spades Partners).
- 9 cards each, **5 face down to the nest**. Deal rotates clockwise each hand.

**Bidding**
- Bids are in points: **70 minimum, 120 maximum, steps of 5**.
- The dealer bids first *(default; the rules say the dealer opens)*, then clockwise.
- A player who passes is out of bidding for that hand. Bidding ends when three have passed.
- If all four pass, the dealer must take the bid at 70 *(default)*.
- A player whose hand has no point cards may ask for a redeal during bidding.

**Nest and trump**
- The high bidder takes the 5 nest cards (14 in hand), then puts any 5 face down.
  Point cards may be put down.
- The bidder then names trump (one of the four colours).
- Whoever wins the **last trick** takes the 5 put-down cards and scores their points.

**Play**
- The bidder leads the first trick *(default)*. Follow the colour led if you can;
  otherwise play anything. Highest trump wins, else highest card of the colour led.
  Trick winner leads next.
- The **Crow** is the highest trump, whatever colour is trump. It may be played to any
  trick, even when you could follow suit. You must play it when trump is led and it is
  your only trump. It may be led; if it is, everyone must play trump if they can.
- The game only allows legal cards, so reneging can't happen.

**Scoring**
- Each side counts the point cards in its tricks (plus the nest for the last trick).
- Bidding side makes its bid → it scores all the points it took.
- Bidding side falls short ("set") → it loses the amount of its bid; its points don't count.
- The other side always scores what it took. Scores can go below zero.

**Game end**
- First side to **300** wins. If both pass 300 in the same hand, the higher total wins;
  if tied, play another hand *(default)*.

**Bots (first version)**
- Bid: count likely points from honours, length in the best colour and the Crow; never
  bid above a safe estimate, and pass instead of overbidding partner.
- Nest: keep the longest colour as trump, put down short side colours, and put point
  cards down only when they would otherwise be lost.
- Play: reuse the Spades expert idea (sample the unseen cards and play hands out) once
  the simple bot works. Skill levels by table bet, same as Spades.

### Hosting (owner decision, 2026-10-27)
- Crows Haven does **not** go on Render. It goes on **Vercel** as a static app.
- Vercel can't run the websocket server, so **version one is played against computer
  players only**. Online/private tables wait until a separate multiplayer host is chosen.
- Spades stays exactly as it is: on Render, from `main`. Nothing in this work changes it.

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
