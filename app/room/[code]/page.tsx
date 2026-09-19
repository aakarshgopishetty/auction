'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClientRoom, UseClientRoomResult } from '@/lib/hooks/useClientRoom';
import { formatLakhs, computeNextMinBid } from '@/lib/money';
import { maxLegalBid, roleCounts, overseasCount } from '@/lib/engine/squadRules';
import { PlayerCard } from '@/components/PlayerCard';
import { Countdown } from '@/components/Countdown';
import { PurseBar } from '@/components/PurseBar';
import { TeamBadge } from '@/components/TeamBadge';
import { ResultStamp } from '@/components/ResultStamp';
import { Toggle } from '@/components/Toggle';
import { BidTicker } from '@/components/BidTicker';
import { SoundToggle } from '@/components/SoundToggle';
import { useAuctionSounds } from '@/lib/hooks/useAuctionSounds';
import { RoomState } from '@/lib/room/engine';
import { RoomMember, Team } from '@/lib/types';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const room = useClientRoom(code);
  const [joinName, setJoinName] = useState(searchParams.get('name') ?? '');
  const [busy, setBusy] = useState(false);
  useAuctionSounds(room.state);

  // Arrived from /join with a name in the URL and no saved session yet? Connect right away.
  useEffect(() => {
    const urlName = searchParams.get('name');
    if (room.status === 'idle' && !room.savedSession && urlName) {
      const role = searchParams.get('spectator') === '1' ? 'spectator' : 'owner';
      room.connect(urlName, role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, room.savedSession]);

  function act(fn: () => void) {
    setBusy(true);
    fn();
    setTimeout(() => setBusy(false), 350);
  }

  const me = useMemo(() => room.state?.members.find((m) => m.id === room.memberId) ?? null, [room.state, room.memberId]);
  const myTeam = useMemo(() => room.state?.teams.find((t) => t.id === me?.team_id) ?? null, [room.state, me]);

  if (room.state?.room.status === 'completed') {
    router.push(`/results/${code}`);
  }

  if (!me || !room.state) {
    return (
      <ConnectScreen code={code} room={room} joinName={joinName} setJoinName={setJoinName} />
    );
  }

  const preAuction = ['lobby', 'configuring', 'ready'].includes(room.state.room.status);

  return (
    <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-6 gap-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs text-ink-muted uppercase tracking-widest">{code}</div>
          <div className="font-display text-lg">{me.display_name} {me.role === 'spectator' && '· Spectator'}</div>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle defaultEnabled={room.state.config.sound_enabled_default} />
          {myTeam && <TeamBadge team={myTeam} size="lg" />}
        </div>
      </header>

      {room.error && <div className="rounded-lg border border-crimson bg-panel px-4 py-2 text-sm text-crimson">{room.error}</div>}

      {preAuction ? (
        <LobbyView state={room.state} me={me} busy={busy} act={act} dispatch={room.dispatch} />
      ) : (
        <AuctionView state={room.state} me={me} myTeam={myTeam} busy={busy} act={act} dispatch={room.dispatch} />
      )}
    </main>
  );
}

function ConnectScreen({
  code, room, joinName, setJoinName,
}: { code: string; room: UseClientRoomResult; joinName: string; setJoinName: (v: string) => void }) {
  const reconnecting = !!room.savedSession && room.status !== 'error';

  if (room.status === 'connecting' || reconnecting) {
    return <Centered>Connecting to {code}…</Centered>;
  }

  return (
    <Centered>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6">
        <h1 className="font-display text-2xl">Join {code}</h1>
        <input
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
          placeholder="Your display name"
          className="mt-4 w-full rounded-lg border border-line bg-panel-raised px-4 py-3 outline-none focus:border-gold"
        />
        {room.error && <p className="mt-2 text-sm text-crimson">{room.error}</p>}
        <button
          onClick={() => room.connect(joinName.trim(), 'owner')}
          disabled={!joinName.trim()}
          className="mt-4 w-full rounded-xl bg-gold text-void font-display text-lg py-3 disabled:opacity-50"
        >
          Join
        </button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 flex items-center justify-center px-6 text-center">{children}</main>;
}

type Dispatch = UseClientRoomResult['dispatch'];

function LobbyView({
  state, me, busy, act, dispatch,
}: { state: RoomState; me: RoomMember; busy: boolean; act: (fn: () => void) => void; dispatch: Dispatch }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-panel p-4">
        <div className="text-sm text-ink-muted">Waiting in the lobby — the host will start once everyone&apos;s ready.</div>
        <label className="mt-3 flex items-center justify-between">
          <span>I&apos;m ready</span>
          <Toggle
            checked={me.is_ready}
            onChange={(v) => act(() => dispatch('setReady', { ready: v }))}
            disabled={busy || me.role === 'spectator'}
            label="I'm ready"
          />
        </label>
      </div>

      <div>
        <h2 className="font-display text-xl mb-2">Franchises</h2>
        <div className="grid grid-cols-2 gap-2">
          {state.teams.map((t) => {
            const occupant = state.members.find((m) => m.id === t.owner_member_id);
            const isMine = t.id === me.team_id;
            return (
              <button
                key={t.id}
                disabled={busy || me.role === 'spectator' || (!!occupant && !isMine)}
                onClick={() => act(() => dispatch('claimTeam', { teamId: t.id }))}
                className={`rounded-xl border p-3 text-left transition-colors ${isMine ? 'border-gold bg-panel-raised' : 'border-line bg-panel'} disabled:opacity-60`}
              >
                <TeamBadge team={t} />
                <div className="mt-2 text-sm text-ink-muted truncate">{occupant ? occupant.display_name : 'Available'}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-4 text-sm text-ink-muted">
        <div className="flex justify-between"><span>Connected players</span><span>{state.members.filter((m) => m.role !== 'spectator' && m.is_connected).length}</span></div>
        <div className="flex justify-between mt-1"><span>Starting purse</span><span>{formatLakhs(state.config.starting_purse_lakhs)}</span></div>
        <div className="flex justify-between mt-1"><span>RTM</span><span>{state.config.rtm_enabled ? `Enabled (${state.config.rtm_cards_per_team} card${state.config.rtm_cards_per_team === 1 ? '' : 's'})` : 'Disabled'}</span></div>
      </div>
    </div>
  );
}

function AuctionView({
  state, me, myTeam, busy, act, dispatch,
}: { state: RoomState; me: RoomMember; myTeam: Team | null; busy: boolean; act: (fn: () => void) => void; dispatch: Dispatch }) {
  const s = state.auctionState;
  const currentAP = state.auctionPlayers.find((ap) => ap.id === s.current_auction_player_id) ?? null;
  const currentPlayer = state.players.find((p) => p.id === currentAP?.player_id) ?? null;
  const highestTeam = state.teams.find((t) => t.id === s.current_highest_team_id) ?? null;

  const myPurchases = state.purchases.filter((p) => p.team_id === myTeam?.id).map((p) => ({ ...p, player: state.players.find((pl) => pl.id === p.player_id)! })).filter((p) => p.player);
  const counts = myTeam ? roleCounts(myPurchases) : null;
  const overseasOnTeam = myTeam ? overseasCount(myPurchases) : 0;
  const cheapestBase = state.players.length ? Math.min(...state.players.map((p) => p.base_price_lakhs)) : 20;
  const myMaxBid = myTeam ? maxLegalBid(myTeam, myPurchases.length, state.config, cheapestBase) : 0;

  const nextAsk = currentPlayer
    ? computeNextMinBid(s.current_highest_bid_lakhs, currentPlayer.base_price_lakhs, state.config.bid_increment_schedule)
    : null;

  const iAmHighest = !!myTeam && myTeam.id === s.current_highest_team_id;
  const canBid = me.role === 'owner' && !!myTeam && !iAmHighest && (s.phase === 'bidding' || s.phase === 'countdown');
  const rtmEligible = !!myTeam && state.config.rtm_enabled && myTeam.rtm_cards_remaining > 0 && !iAmHighest
    && currentPlayer?.previous_team_hint === myTeam.franchise_code
    && (s.phase === 'bidding' || s.phase === 'countdown');

  if (!s || s.phase === 'ready' || s.phase === 'set_transition' || !currentPlayer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-16">
        <div className="text-ink-muted">Waiting for the host to bring up the next player…</div>
        {myTeam && <TeamDashboard team={myTeam} purchases={myPurchases} config={state.config} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(s.phase === 'sold' || s.phase === 'unsold') ? (
        <div className="flex justify-center py-6">
          <ResultStamp outcome={s.phase} player={currentPlayer} team={highestTeam} price={s.current_highest_bid_lakhs} />
        </div>
      ) : (
        <>
          <PlayerCard player={currentPlayer} />

          <div className="flex items-center justify-between rounded-2xl border border-line bg-panel p-4">
            <div>
              <div className="text-xs text-ink-muted uppercase tracking-wide">{s.current_highest_team_id ? 'Current bid' : 'Opening bid'}</div>
              <div className="font-display text-3xl text-gold">{formatLakhs(s.current_highest_bid_lakhs ?? currentPlayer.base_price_lakhs)}</div>
              {highestTeam && <div className="mt-1"><TeamBadge team={highestTeam} size="sm" /></div>}
            </div>
            {s.phase === 'countdown' && <Countdown endsAt={s.countdown_ends_at} totalSeconds={state.config.countdown_seconds} />}
          </div>

          <BidTicker bids={state.bids} teams={state.teams} currentAuctionPlayerId={s.current_auction_player_id} />

          {s.phase === 'paused' ? (
            <div className="text-center rounded-2xl border border-gold bg-panel py-6">
              <div className="font-display text-2xl text-gold">⏸ Auction Paused</div>
              <div className="text-sm text-ink-muted mt-1">Hang tight — the host will resume shortly.</div>
            </div>
          ) : me.role === 'owner' && myTeam ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={busy || !canBid}
                onClick={() => act(() => dispatch('bid', { auctionPlayerId: currentAP?.id }))}
                className="rounded-2xl bg-gold text-void font-display text-2xl py-6 disabled:opacity-40 animate-bid-pulse"
              >
                BID {nextAsk != null ? formatLakhs(nextAsk) : ''}
              </button>
              <button disabled className="rounded-2xl border border-line text-ink-muted font-display text-2xl py-6 opacity-60">PASS</button>
              {rtmEligible && (
                <button
                  disabled={busy}
                  onClick={() => act(() => dispatch('rtm', { auctionPlayerId: currentAP?.id }))}
                  className="col-span-2 rounded-2xl border border-emerald text-emerald font-display text-lg py-4"
                >
                  Use RTM — Match {formatLakhs(s.current_highest_bid_lakhs ?? 0)}
                </button>
              )}
              <div className="col-span-2 text-center text-xs text-ink-muted">
                Maximum possible bid: <span className="text-ink">{formatLakhs(myMaxBid)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-ink-muted text-sm py-2">
              {me.role === 'spectator' ? 'You are spectating this auction.' : 'You are not assigned to a franchise.'}
            </div>
          )}
        </>
      )}

      {myTeam && <TeamDashboard team={myTeam} purchases={myPurchases} config={state.config} countsOverride={counts ?? undefined} overseas={overseasOnTeam} />}
    </div>
  );
}

function TeamDashboard({
  team, purchases, config, countsOverride, overseas,
}: {
  team: { id: string; purse_remaining_lakhs: number; purse_total_lakhs: number; rtm_cards_remaining: number };
  purchases: { final_price_lakhs: number }[];
  config: { max_squad_size: number; max_overseas: number };
  countsOverride?: Record<string, number>;
  overseas?: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 space-y-3">
      <PurseBar remaining={team.purse_remaining_lakhs} total={team.purse_total_lakhs} squadCount={purchases.length} maxSquad={config.max_squad_size} />
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {countsOverride && Object.entries(countsOverride).map(([role, n]) => (
          <div key={role} className="rounded-lg bg-panel-raised py-2">
            <div className="font-display text-lg">{n}</div>
            <div className="text-ink-muted capitalize">{role.replace('_', ' ')}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink-muted">
        <span>Overseas {overseas ?? 0} / {config.max_overseas}</span>
        <span>RTM cards left: {team.rtm_cards_remaining}</span>
      </div>
    </div>
  );
}
