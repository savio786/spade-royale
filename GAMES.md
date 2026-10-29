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

## 2. Second game: Crows Haven (playable vs computer players, in the browser)

Crows Haven-only files:
- `shared/crows/engine.ts` — deck, bidding, nest, trump, tricks, scoring, `CrowsState`
- `shared/crows/bot.ts` — computer players: bid, nest + trump, card play
- `scripts/simulate-crows.ts` — rule tests + 4,000 bot games (`npm run sim:crows`)
- `src/crows/CrowsTable.tsx` — the Crows Haven table (bidding, nest, play, hand summary, game over, rules)
- `src/crows/CrowCard.tsx` — our own card faces (Sky cloud, Ember flame, Moss leaf, Plum berry, the Crow)
- `src/crows/crows.css` — Crows styles, all prefixed so Spades styles are untouched

- `src/crows/CrowsSite.tsx` — the Crows Haven site: welcome page, guest start, home screen
- `src/crows/online.ts` — online play: Play online / private tables, the live connection, reconnects
- `shared/crows/protocol.ts`, `shared/crows/chat.ts` — messages and fixed chat list shared by the game and the server
- `crows-server/` — the Cloudflare game server (own package.json; not part of the Spades build)
- `src/crows/CrowsChat.tsx` — table chat: preset phrases + emoji only (no typing), bubbles on seats, computer players reply
- `src/crows/CrowsRanking.tsx` — weekly ranking page; each finished game is sent to the ranking
- `api/crows-rank.ts` — Vercel function for the weekly ranking (Render/Spades never runs it). Needs an Upstash Redis
  database connected to the crows-haven Vercel project (Storage → Upstash for Redis); until then the page says "almost ready".
  Weeks start Sunday 00:00 UTC; ranked by games won, then points. Results come from the browser (no game server),
  so each player id is tied to a device secret, rate-limited (1 game / 2 min) and capped.
- `src/crows/CrowsExtras.tsx` — pictures. Players pick from 12 AI portraits, cartoon characters (drawn people + robot,
  alien, pirate…), animals, things and flowers, or their own photo. Computer players always use the 82 AI portraits
  (40 of Crows Haven's own + the 42 Spades ones from `public/brand/bots/`)
- `src/crows/ExtraArt.tsx` — Crows Haven's own drawings: 10 flowers and 12 things
- `src/crows/portraits.ts` + `public/crows/portraits/c1–c40.webp` — Crows Haven's own 40 AI portraits (from the owner, 2026-10-27) and the names computer players use with them (photo kept on the device; this site has no server), install-the-app help
- `public/crows/` — crow icons (SVG + PNG 192/512/maskable/apple) and the app manifest for the Crows Haven site

The Crows Haven site is the same app built with `VITE_CROWS=1` (the crows-haven Vercel project).
Shared files touched (Spades behaves exactly as before; without `VITE_CROWS` nothing changes):
- `src/App.tsx` — with `VITE_CROWS=1` it shows only the Crows Haven screens
- `vite.config.ts` — with `VITE_CROWS=1` the page title, icon, manifest and link previews say Crows Haven
- `src/main.tsx` — with `VITE_CROWS=1` the offline/install service worker is registered even though `VITE_OFFLINE=1`
  (checked: the Spades build's index.html is identical to `main`'s)
- The Spades lobby is unchanged (no game switch).

Version one: practice table, no coins or XP, you + partner vs two computer players.

A four-player **partnership trick-taking game with bidding, a trump-suit choice and a
"nest" of extra cards** — in the style of the classic game Rook, but with its own name,
its own rules text and its own card art.

Working name: **Crows Haven** (chosen by the owner; the rook is a kind of crow, and "crow's nest" echoes the nest of extra cards).

Naming: do NOT call it "Rook" (or "Rook Haven") and do not copy the original game's deck or branding
(the name and deck are commercially owned). Before launch, search the trademark database
for "Crows Haven" (also "Crow Haven" and "Haven") and have a lawyer confirm; this file is not legal advice.

### Rules (settled with the owner, 2026-10-27)

Crows Haven follows the **published Rook partnership rules with the 1s in the deck**
(owner decision 2026-10-27: first the tournament rules without 1s, then the 1s added the same day),
with our own deck art and names. Nest, discard, lead and trump rules are as first settled.
Items marked *(default)* are our choice where the published versions differ; the owner can change them.

**Deck — 45 cards, our own design**
- Four coloured suits, each with **1 and 5 to 14** (44 cards), plus one **Crow** card (our bird card).
- Suit colours, card art and the Crow artwork are our own; no Rook logo, bird art or wording.
- Rank inside a suit: **1 highest**, then 14, 13 … down to 5.

**Point cards (180 points in the deck)**
- each 1 = 15 · each 14 = 10 · each 10 = 10 · each 5 = 5 · the Crow = 20

**Deal**
- 4 players, fixed partners sitting opposite (same seating as Spades Partners).
- 10 cards each, **5 face down to the nest**. Deal rotates clockwise each hand.

**Bidding**
- Bids are in points: **100 minimum, 180 maximum, steps of 5**.
- The dealer bids first *(default; the rules say the dealer opens)*, then clockwise.
- A player who passes is out of bidding for that hand. Bidding ends when three have passed.
- If all four pass, the dealer must take the bid at 100.
- A player whose hand has no point cards may ask for a redeal during bidding.

**Nest and trump**
- The high bidder takes the 5 nest cards (15 in hand), then puts any 5 face down.
  *(default — some versions forbid putting point cards down)*
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
- First side to the **game points** wins: the player picks **300, 400 or 500** on the home screen
  (default 500, remembered on the device). If both pass it in the same hand, the higher total wins;
  if tied, play another hand *(default)*.

**Bots (first version)**
- Bid: count likely points from honours, length in the best colour and the Crow; never
  bid above a safe estimate, and pass instead of overbidding partner.
- Nest: keep the longest colour as trump, put down short side colours, and put point
  cards down only when they would otherwise be lost.
- Play: reuse the Spades expert idea (sample the unseen cards and play hands out) once
  the simple bot works. Skill levels by table bet, same as Spades.

### Hosting (owner decision, 2026-10-27)
- Crows Haven does **not** go on Render. The site is on **Vercel** (project crows-haven, branch `second-game`,
  `VITE_CROWS=1`, `VITE_OFFLINE=1`).
- Online play (owner decision 2026-10-28): a separate **Crows Haven game server on Cloudflare**
  (`crows-server/`: a Worker with Durable Objects — `Lobby` matches players, one `Table` per table).
  It runs the same `shared/crows` engine and bots. Deployed by `.github/workflows/crows-server.yml` on pushes to
  `second-game` once the repo has the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
  Live at https://crows-haven-server.savio-dias.workers.dev (Cloudflare worker `crows-haven-server`, owner's account,
  deployed 2026-10-28; `/health` answers).
  The site finds it through `VITE_CROWS_SERVER` (the server's https address) in Vercel; without it, online
  buttons are hidden and only "vs computer" play shows.
- Online tables, like Spades: "Play online" seats you at a public table with the same game points; each empty
  seat gets a 15 s countdown, then a computer player (AI portrait) sits down; "Start now" brings computer
  players in one by one, 5 s apart (the first right away), and the game deals when all four seats are full.
  Private tables get a 5-letter code and wait for the host to start. 20 s per turn (40 s for the nest), then the
  game plays for you; after 3 missed turns or a lost connection a computer player plays your seat until you're
  back (a reload puts you back in your seat). Chat is the fixed phrase/emoji list, checked on the server.
- Test locally: `cd crows-server && npx wrangler dev --var TIME_SCALE:0.1` and build the site with
  `VITE_CROWS_SERVER=http://127.0.0.1:8787`.
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
