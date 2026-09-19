# Auction Night

A live, multi-device IPL-style cricket auction for you and your friends.
Next.js 16 + TypeScript + Tailwind — **no database, no backend, no
signup beyond deploying the site itself.** Every phone connects directly
to the host's browser over WebRTC.

This README is deliberately honest about what's fully built vs. what's
scaffolded for a follow-up pass, and about the one real trade-off of
this architecture — see below before you run your first real auction.

---

## 1. How it's architected

- **The host's browser tab *is* the server.** When you click "Create
  Room," your browser builds the entire auction state (franchises,
  players, purse, rules) in memory and registers itself as a
  [PeerJS](https://peerjs.com) peer under an ID derived from the room
  code. Every rule — purse limits, squad size, overseas caps, RTM,
  race-safe bidding, undo — runs as plain TypeScript in that tab
  (`lib/room/engine.ts`), the same logic that used to run as Postgres
  functions, just moved into the browser.
- **Bidders and spectators connect directly to the host** over a WebRTC
  data channel — no server in between relays the actual auction data.
  PeerJS's free public broker is used only to help two browsers find
  each other (like a phone book); once connected, bids, purses, and
  state updates flow peer-to-peer.
- **State is saved to the host's `localStorage`** after every change, so
  a host who accidentally refreshes their tab doesn't lose the auction —
  reopening `/host/<code>` rebuilds the session from that snapshot.
  Bidders' phones save their own room code + player ID in *their*
  `localStorage`, so a refreshed phone reconnects and gets its franchise
  and squad back automatically.
- **The one real trade-off: the host's tab has to stay open and online**
  for the auction to keep running. If the host closes their laptop or
  loses their network mid-auction, bidders lose their connection until
  the host reopens `/host/<code>` on the same device (which restores
  everything from `localStorage` and starts accepting connections
  again). There's no cloud fallback — that's the cost of having no
  server at all. For a game night where the host's laptop plugged in and
  running the whole evening, this is a non-issue in practice.

```
app/
  create, join           lobby entry pages
  host/[code]             host control panel (the "server" UI)
  room/[code]             team owner / spectator mobile view
  display/[code]          broadcast screen for a TV/projector
  results/[code]          final squad analysis + awards
components/               PlayerCard, Countdown, PurseBar, TeamBadge, ResultStamp
lib/
  room/engine.ts           the entire rules engine — pure functions over an in-memory state object
  room/store.ts            wraps the engine: persists to localStorage, notifies subscribers
  room/hostSession.ts      PeerJS host: accepts connections, dispatches actions, broadcasts state
  room/clientSession.ts    PeerJS client: connects to the host, sends actions, receives state
  room/hostSingleton.ts    keeps the host session alive across client-side navigation
  hooks/useHostRoom.ts      hook the host pages use
  hooks/useClientRoom.ts    hook the bidder/spectator/display pages use
  engine/                  squad rules, max-legal-bid, rules-based squad analysis (unchanged)
data/                      starter franchises, auction sets, and a 105-player pool
```

---

## 2. Run it locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in one tab and click **Host an Auction**.
Open a second tab (or your phone, on the same Wi-Fi, via your machine's
LAN IP) and **Join with a Code** using the code the first tab shows.
That's the whole setup — no `.env` file, no database to provision.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project → Import** that repo, and deploy. There is
   nothing to configure — no environment variables, no database, no
   build command changes.
3. Share the deployed URL. Each room lives entirely in whichever
   browser tab created it, so the same deployment can host any number of
   separate auctions at once — they just don't share anything with each
   other.

Because there's no server-side data at all, this also works as a fully
static export (`next.config.ts` → `output: 'export'`) if you ever want
to host it somewhere even simpler than Vercel, like GitHub Pages.

---

## Try the flow from the original brief

`/create` → the host's browser becomes the room → share the code →
others `/join` → claim franchises in the lobby → host opens
`/host/[code]` → **Start Auction** → **Reveal Next** → **Start Bidding**
→ owners tap **BID** from `/room/[code]` on their phones → **Sold** —
purses and squads update on every connected screen instantly, because
it's a direct peer-to-peer message, not a poll. Put `/display/[code]`
on a TV for the broadcast view, and `/results/[code]` for the final
squad analysis and awards.

---

## Status vs. the original spec

**Built and verified** (real `tsc --noEmit` + `next build`):

- Real multi-device sync with **zero backend infrastructure** — WebRTC
  peer-to-peer, no database, no server, no signup
- Room creation/join with codes; lobby with live, race-safe franchise
  claiming (two owners can't grab the same team)
- Full host control panel: reveal, start bidding, sold, unsold, skip,
  pause/resume, jump between sets, and event-sourced **undo** (a
  restore from a stored snapshot, never a fragile recomputation)
- Every other host control from the original brief: a full rules editor
  (purse, squad limits, overseas caps, RTM cards, countdown, and an
  editable bid-increment table), an auction-set manager (enable/disable,
  rename, reorder, add new sets, move a player between sets), a "correct
  a mistake" tool for fixing an accidental bid or clearing it outright,
  **requeue unsold players** for a re-auction round, and either mode of
  franchise assignment — players self-select, or the host assigns every
  franchise directly from the lobby
- The same server-authoritative validation as before — purse checks,
  squad-size checks, overseas checks, a live "maximum possible bid" —
  just running as the host's own JavaScript instead of a database
  function. Because the host processes one message at a time, two
  "simultaneous" bids from two phones still resolve correctly in
  arrival order — there's no database to race against, but there's also
  no way for two bids to be applied out of order
- RTM, with a configurable number of cards per team
- The reveal → base price → bidding → countdown → SOLD/UNSOLD → squad
  update loop, with a broadcast-style player card, a countdown ring, and
  a SOLD/UNSOLD stamp animation
- Team dashboard (purse bar, squad count, role counts, overseas count,
  RTM cards left) and a dedicated **/display** broadcast page for a
  TV/projector
- Host can add/edit/delete players live, edit the auction rules from the
  lobby, and **bulk-import a player list from a JSON file** right in the
  browser (no CLI, no server — just a file picker in the player manager)
- Disconnect/reconnect via each device's own `localStorage` — a
  refreshed phone reconnects to the host and gets its franchise and
  squad back
- A rules-based final **Squad Analysis and Awards** screen — genuinely
  computed from ratings, prices, and roles, no AI text generation
- A 105-player realistic starter pool spread across every set
- **Sound effects** — synthesized tones (Web Audio, no audio files) for
  reveal, bid, sold, and unsold, with a per-device mute toggle that
  respects the host's configured default without forcing it on anyone
- A clear on-screen banner, and the exact error message the brief asked
  for, whenever the host pauses the auction
- **Reveal Next auto-advances to the next enabled set** once the current
  one runs out of pending players, instead of stopping with an error the
  host has to notice and fix manually mid-auction
- Reconnection is genuinely robust now: a phone that drops and rejoins
  can no longer knock its own new connection out of the host's broadcast
  list (a real race in the original PeerJS wiring — an old, not-yet-dead
  connection finally closing *after* a reconnect could silently wipe the
  live one), and the broadcast display / results page can no longer
  hijack — or worse, overwrite — a real player's saved session just
  because it shares a browser with someone who already joined as a team
- A live **bid ticker** on the owner, host, and broadcast screens showing
  the last few bids for the current player, not just who's on top
- A full, searchable auction history (by player name or team) alongside
  the at-a-glance "recent sales" list

**Scaffolded but thinner than the full spec — a fair "phase 2" list:**

- **Player photos** are initials avatars, not real photographs — I
  didn't scrape or embed real athletes' images without rights to them.
  The data model and the host's player editor both support a
  `photo_url` per player if you have images you're licensed to use.
- **Player stats are approximate**, built from general cricket
  knowledge rather than an official feed — good for a fun auction, not
  for a stats argument. The JSON import feature in the host panel lets
  you bring in a more precise dataset.
- **Spectator mode** works for viewing but doesn't have its own distinct
  screen yet — spectators currently see the same layout an unassigned
  owner would.
- The playing-XI overseas cap is stored in config but not yet enforced
  anywhere (only the squad-wide overseas cap is enforced today).
- **NAT/network edge cases**: WebRTC needs the two browsers to establish
  a direct (or STUN-assisted) connection. This works on the overwhelming
  majority of home Wi-Fi, mobile hotspots, and most mobile data
  connections. Very locked-down corporate/campus networks with
  symmetric NAT can occasionally block it — if a specific phone can't
  connect, switching it to mobile data usually fixes it.
- No automated test suite beyond the compiler/lint pass done here.

**One lint note:** `npm run lint` flags a couple of
`react-hooks/purity` / `react-hooks/set-state-in-effect` warnings from
the very new, still-opinionated React Compiler rules bundled with
Next.js 16's `eslint-config-next` — they fire on standard, necessary
patterns here (reading a saved session from `localStorage` on mount, a
countdown timer reading the clock). `next build` itself is unaffected
and already passes cleanly.

---

## Security model, briefly

There's no server to secure, because there's no server. The trust model
is the same as handing someone a controller at game night: knowing the
room code is what lets you connect. Once connected, the money and rule
protections — "only the host can mark a player sold," "you can't bid
more than your purse," "two people can't buy the same player" — are
enforced inside the engine functions themselves
(`lib/room/engine.ts`), which is the equivalent of what used to be
`SECURITY DEFINER` Postgres functions: a bidder's browser can *ask* the
host to do something, but the host's own code is what decides whether
it's allowed, never the asker.
