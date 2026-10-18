# Spade Royale — online Spades (Vite + React + TypeScript)

A complete Spades game with a marketing landing page, installable web app (Windows, macOS, iPad), and native Android/iOS shells (Capacitor) for Google Play and the App Store.

## What's inside

| Area | Features |
|---|---|
| Landing page (`/`) | Hero, Play-in-browser, Google Play / App Store buttons, install button, features, game modes, weekly leaders, platforms, rules |
| Sign-in | Facebook / Google Play Games buttons (local profile until you add keys), Continue as guest, name + avatar |
| Lobby | Coins + store, BUY COINS, level/XP, VIP carousel, +100 coins (rewarded-ad slot), VIP Club, **Play Now**, **Online Lobby**, **Private Game**, Leaders, Trophy, daily bonus wheel, Gifts, Friends, Settings |
| Game modes | **Solo** (4 players, each for themselves) and **Partners** (2 v 2) |
| Tables | City tiers by bet (New York → Monaco), bet slider, game-ending min/max points, prize per winner, filters by room type and points |
| Gameplay | Full rules: bidding 1–13 and Nil, follow suit, spades breaking, trick winner, 10 bags = −100, nil ±100, game-end at max/min points, round summary, victory/defeat, prize payout, XP |
| Bots | Bid estimation, nil protection, covering partner's nil, ducking bags — fill any empty seat |
| Chat | Table chat with quick phrases, emoji, free text, speech bubbles on seats, bots that reply; gifts you can send to players |
| Leaderboard | Global / Friends / Wall of Fame, rank rewards (50K, 25K, 10K, …), countdown to week end, last-week results + reward claim |
| Multiplayer | WebSocket server: quick-match public tables, live table list, private tables with 5-letter invite codes, server-side rules, turn timer (auto-play on timeout), disconnected players replaced by bots |
| Offline | Everything except online/private multiplayer works offline against bots (service worker caches the app) |

## Run it

```bash
npm install
npm run server      # multiplayer server on :8787 (ws path /ws)
npm run dev         # app on http://localhost:5173 (proxies /ws to :8787)
```

Open `http://localhost:5173/` for the landing page or `/#/play` to jump into the game. Without the server, the game runs in offline mode with bots.

Other scripts:

- `npm run build` — type-check and build to `dist/`
- `npm run sim` — plays 4,000 bot games to check the engine
- `npm run icons` — re-render the PNG app icons from `public/icons/icon.svg` (needs Playwright Chromium)

## Project layout

```
shared/        engine.ts (rules + scoring), bot.ts (AI), runtime.ts (a live table: bots, timers, chat), protocol.ts
server/        index.ts — WebSocket server + static hosting of dist/
src/screens/   Landing, Login, Lobby, OnlineLobby, Table, modals (leaderboard, store, VIP, gifts, friends, trophies, settings, create table, private game)
src/lib/       profile (wallet, XP, stats, leaderboard), controller (local vs online table), net, sound
public/        manifest.webmanifest, sw.js, icons
android/ ios/  Capacitor native projects
```

The same `shared/` engine runs in the browser (offline play) and on the server (online play), so rules are identical everywhere.

## Running free ($0) on Render

The live service runs on Render's free plan with two settings:

- `KEEP_AWAKE=1` makes the server visit its own `/health` page every 10 minutes, so Render never puts it to sleep. One service running all month fits inside Render's 750 free hours.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` store the leaderboard, Wall of Fame and purchases in a free Upstash Redis database, so restarts don't wipe them. Without these two settings the server saves to files in `DATA_DIR`, which is fine on your own computer or with a paid Render disk.

Free-plan limit: Render still restarts free services now and then, and on every deploy. Games in progress at that moment are interrupted, but saved data is kept.

## Put it on a website

**Full version (multiplayer + private tables): Render, one click.** Push this folder to a GitHub repo, then in Render choose *New → Blueprint* and pick the repo. `render.yaml` + `Dockerfile` build the site and start the server on one URL. Add your own domain under *Settings → Custom Domains*.

**Static version (vs computer players): Vercel or Netlify.** Import the repo; `vercel.json` sets the build. Set `VITE_SERVER_URL=wss://<your-render-app>.onrender.com/ws` in the project's environment variables to switch on multiplayer from the Render server, or `VITE_OFFLINE=1` for bots only. Vercel can't run the websocket server itself.

## Deploy the web version (Windows, MacBook, iPad)

1. `npm run build`
2. Run the server on any Node 18+ host (Render, Railway, Fly.io, a VPS): `PORT=8787 npm run server`. It serves `dist/` and the websocket on the same origin, so no extra config is needed. Put it behind HTTPS (required for installing the app).
3. Players open your URL and install it:
   - **Windows / MacBook (Chrome or Edge):** the install icon in the address bar, or *Settings → Install app* in the game. Safari on Mac: *File → Add to Dock*.
   - **iPad / iPhone (Safari):** *Share → Add to Home Screen*. It opens full-screen in landscape.
   - **Android (Chrome):** *Install app*.

If you host the web build somewhere else (e.g. Netlify) and the server separately, set `VITE_SERVER_URL=wss://your-server/ws` in `.env` before building.

## Google Play (Android)

Requirements: Android Studio, a Google Play Console account ($25 one-time).

```bash
cp .env.example .env            # set VITE_SERVER_URL to your deployed server (wss://…/ws)
npm run cap:android             # builds, syncs and opens Android Studio
```

1. Change `appId` in `capacitor.config.ts` (e.g. `com.yourcompany.spades`) before your first release, then run `npx cap sync`.
2. Icons/splash: `npx @capacitor/assets generate` (uses `resources/icon.png` and `resources/splash.png`).
3. Android Studio → *Build → Generate Signed Bundle* → **AAB**. Keep the keystore safe.
4. Play Console → create the app → upload the AAB to Internal testing → fill in content rating, data safety and store listing → promote to Production.

The activity is locked to landscape (`android/app/src/main/AndroidManifest.xml`).

## Apple App Store (iPhone / iPad)

Requirements: a Mac with Xcode, an Apple Developer account ($99/year).

```bash
npm run cap:ios                 # builds, syncs and opens Xcode
```

1. In Xcode select the *App* target → *Signing & Capabilities* → choose your team; set the bundle id to match `appId`.
2. Generate icons (`npx @capacitor/assets generate --ios`).
3. *Product → Archive* → *Distribute App* → App Store Connect.
4. In App Store Connect add screenshots (iPhone and iPad), description, age rating, then submit for review.

Landscape-only and full-screen are set in `ios/App/App/Info.plist`.

## Payments (coins and Chat Pass)

What players can buy is listed in `shared/products.ts`:

| Product | Price |
|---|---|
| 25,000 / 150,000 / 400,000 / 1M / 3M / 8M coins | $0.99 / $4.99 / $9.99 / $19.99 / $49.99 / $99.99 |
| Chat Pass: 1 day / 30 days / lifetime | $0.99 / $2.99 / $9.99 |

- **Chat is paid.** Without a Chat Pass, players can read table chat and send gifts, but can't send messages, quick phrases or emoji. VIP members get chat included. The server checks this too, not just the app.
- **Buying coins when short.** Whenever a player picks a table they can't afford, the store opens and says how many coins they're missing. It also shows a "Running low on coins" bar in the lobby and a "Buy coins to play again" button after a game.

**Taking real payments on the website (Stripe)**

1. Create a Stripe account at https://dashboard.stripe.com.
2. In Stripe go to *Developers → Webhooks → Add endpoint*. Use the URL `https://YOUR-SITE/api/stripe-webhook` and select the event `checkout.session.completed`.
3. On your server (for example Render → *Environment*), set:
   - `STRIPE_SECRET_KEY` = your secret key (`sk_live_…`, or `sk_test_…` to try it with test cards)
   - `STRIPE_WEBHOOK_SECRET` = the signing secret of the webhook from step 2 (`whsec_…`)
4. Redeploy. The store switches from test mode to Stripe Checkout automatically. After paying, players return to the game and their coins or Chat Pass are added within seconds. Every payment is verified with Stripe's signature, and each one is delivered only once.

Purchases are stored in `DATA_DIR/purchases.json` next to the leaderboard, so keep the Render disk from `render.yaml`.

## Turning the demo hooks into production features

These are wired up in the UI but use placeholders until you add your own accounts and keys:

- **Sign-in**: the Facebook and Google Play Games buttons create a local profile. For real accounts, add Firebase Authentication (web) or `@capacitor-firebase/authentication` (native), then send the verified user id in the server `hello` message.
- **Payments in the phone apps**: Apple and Google require their own billing for coins and Chat Passes inside apps. Use Google Play Billing and StoreKit, for example through RevenueCat (`@revenuecat/purchases-capacitor`). Until then the apps' store runs in test mode.
- **Rewarded ads**: the “+100 coins AD” slot is a 5-second placeholder. Use `@capacitor-community/admob` on mobile.
- **Wallet security**: coins, XP and stats are stored on the device (`src/lib/profile.ts`). Before launch, move the wallet and leaderboard into a database on the server (for example Postgres or Firestore), and settle bets and prizes there. That way players can't edit their own balance.
- **Store policy**: coins are virtual and can't be cashed out. Google Play and Apple treat purchasable coins for card games as “simulated gambling”, so you'll need the matching age rating (17+ on iOS, an IARC rating on Play). Real-money tournaments like Skillz's need gambling licenses and a different integration.

## Rules implemented

- Partners: bids are combined. A side that makes its bid gets 10 × bid, plus 1 point for each overtrick (bag). A side that misses gets −10 × bid.
- Nil: +100 if that player takes no tricks, −100 if they take any. A failed nil's tricks still count toward the partner's bid.
- Every 10 bags costs 100 points.
- Spades can't be led until they're broken, unless you hold only spades.
- The game ends when any side reaches the max points or drops to the min points. The highest score wins, and a tie plays another round.
- Prize: Partners winners get 1.8× the bet each. The Solo winner gets 3.6× the bet. VIP adds 10%.
