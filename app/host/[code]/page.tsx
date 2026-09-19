'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHostRoom } from '@/lib/hooks/useHostRoom';
import { formatLakhs } from '@/lib/money';
import { PlayerCard } from '@/components/PlayerCard';
import { Countdown } from '@/components/Countdown';
import { TeamBadge } from '@/components/TeamBadge';
import { ResultStamp } from '@/components/ResultStamp';
import { Toggle } from '@/components/Toggle';
import { BidTicker } from '@/components/BidTicker';
import { SoundToggle } from '@/components/SoundToggle';
import { useAuctionSounds } from '@/lib/hooks/useAuctionSounds';
import { RoomState } from '@/lib/room/engine';
import { AuctionConfig, Player } from '@/lib/types';

export default function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const room = useHostRoom(code);
  useAuctionSounds(room.state);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);

  function act(fn: () => void) {
    setBusy(true);
    setMessage(null);
    try {
      fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setTimeout(() => setBusy(false), 200);
    }
  }

  const state = room.state;
  const s = state?.auctionState;
  const currentAP = state?.auctionPlayers.find((ap) => ap.id === s?.current_auction_player_id) ?? null;
  const currentPlayer = state?.players.find((p) => p.id === currentAP?.player_id) ?? null;
  const highestTeam = state?.teams.find((t) => t.id === s?.current_highest_team_id) ?? null;
  const currentSet = state?.auctionSets.find((set) => set.id === s?.current_set_id) ?? null;
  const sortedSets = [...(state?.auctionSets ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const setQueue = useMemo(
    () => (state?.auctionPlayers ?? []).filter((ap) => ap.set_id === currentSet?.id).sort((a, b) => a.sequence_order - b.sequence_order),
    [state?.auctionPlayers, currentSet]
  );
  const pendingInSet = setQueue.filter((ap) => ap.status === 'pending').length;
  const soldCount = state?.purchases.length ?? 0;
  const unsoldCount = state?.auctionPlayers.filter((ap) => ap.status === 'unsold').length ?? 0;

  function handleRevealNext() {
    act(() => {
      try {
        room.dispatch('reveal');
      } catch (e) {
        const isSetExhausted = e instanceof Error && e.message.includes('No players remaining');
        if (!isSetExhausted || !state) throw e;

        const sorted = [...state.auctionSets].sort((a, b) => a.sort_order - b.sort_order);
        const currentIdx = sorted.findIndex((set) => set.id === currentSet?.id);
        const nextSet = sorted.slice(currentIdx + 1).find(
          (set) => set.is_enabled && state.auctionPlayers.some((ap) => ap.set_id === set.id && ap.status === 'pending')
        );
        if (!nextSet) throw e; // no set anywhere has a pending player left — surface the real message

        room.dispatch('jumpSet', { setId: nextSet.id });
        room.dispatch('reveal');
        setNotice(`"${currentSet?.name}" is finished — moved on to "${nextSet.name}".`);
        setTimeout(() => setNotice(null), 4000);
      }
    });
  }

  if (room.loading) return <Centered>Loading…</Centered>;
  if (room.error || !state) return <Centered><p className="text-ink-muted max-w-sm">{room.error}</p></Centered>;

  const preAuction = ['lobby', 'configuring', 'ready'].includes(state.room.status);

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-ink-muted uppercase tracking-widest flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${room.connStatus === 'open' ? 'bg-emerald' : 'bg-crimson'}`} />
            Host Control Panel {room.connStatus && room.connStatus !== 'open' && <span className="text-crimson">· {room.connStatus}</span>}
          </div>
          <div className="font-display text-3xl text-gold">{code}</div>
        </div>
        <div className="flex gap-2">
          <SoundToggle defaultEnabled={state?.config.sound_enabled_default ?? true} />
          <Link href={`/display/${code}`} target="_blank" className="rounded-lg border border-line px-4 py-2 text-sm hover:border-gold transition-colors">Broadcast Display</Link>
          <Link href={`/room/${code}`} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-gold transition-colors">My Team View</Link>
        </div>
      </header>

      {room.connStatus === 'error' && (
        <div className="rounded-lg border border-crimson bg-panel px-4 py-2 text-sm text-crimson">
          Connection problem{room.connError ? `: ${room.connError}` : ''} — bidders may not be able to reach this
          room. Try reloading this page; your auction is safely saved either way.
        </div>
      )}
      {room.connStatus === 'retrying' && (
        <div className="rounded-lg border border-gold bg-panel px-4 py-2 text-sm text-gold">
          Reconnecting to the room code — this is normal right after a refresh, one moment…
        </div>
      )}

      {message && <div className="rounded-lg border border-crimson bg-panel px-4 py-2 text-sm text-crimson">{message}</div>}
      {notice && <div className="rounded-lg border border-gold bg-panel px-4 py-2 text-sm text-gold">{notice}</div>}

      {preAuction ? (
        <LobbyManager state={state} busy={busy} act={act} dispatch={room.dispatch}
          showConfig={showConfig} setShowConfig={setShowConfig}
          showSets={showSets} setShowSets={setShowSets}
          onStart={() => act(() => room.dispatch('startAuction'))} />
      ) : state.room.status === 'completed' ? (
        <div className="rounded-2xl border border-gold bg-panel p-6 text-center space-y-3">
          <div className="font-display text-2xl">Auction complete</div>
          <Link href={`/results/${code}`} className="inline-block rounded-xl bg-gold text-void font-display text-lg px-6 py-3">
            View Final Results
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-panel p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>Set: <span className="text-ink-muted">{currentSet?.name ?? '—'}</span> · {pendingInSet} left</span>
            <span>Sold: <span className="text-gold">{soldCount}</span></span>
            {unsoldCount > 0 && <span>Unsold: <span className="text-crimson">{unsoldCount}</span></span>}
            <span>Connected: {state.members.filter((m) => m.is_connected).length}/{state.members.length}</span>
            <select
              className="rounded-lg border border-line bg-panel-raised px-2 py-1"
              value={currentSet?.id ?? ''}
              onChange={(e) => act(() => room.dispatch('jumpSet', { setId: e.target.value }))}
            >
              {sortedSets.map((set) => <option key={set.id} value={set.id}>{set.name}{!set.is_enabled ? ' (disabled)' : ''}</option>)}
            </select>
          </div>

          {currentPlayer && s?.phase !== 'sold' && s?.phase !== 'unsold' && (
            <div className="flex justify-center"><PlayerCard player={currentPlayer} animate={false} /></div>
          )}
          {currentPlayer && (s?.phase === 'sold' || s?.phase === 'unsold') && (
            <div className="flex justify-center py-4">
              <ResultStamp outcome={s.phase} player={currentPlayer} team={highestTeam} price={s.current_highest_bid_lakhs} />
            </div>
          )}
          {currentPlayer && (s?.phase === 'bidding' || s?.phase === 'countdown') && (
            <div className="flex items-center justify-center gap-6 rounded-2xl border border-line bg-panel p-4">
              <div className="text-center">
                <div className="text-xs text-ink-muted uppercase">Current bid</div>
                <div className="font-display text-3xl text-gold">{formatLakhs(s.current_highest_bid_lakhs ?? currentPlayer.base_price_lakhs)}</div>
                {highestTeam && <div className="mt-1"><TeamBadge team={highestTeam} /></div>}
              </div>
              {s.phase === 'countdown' && <Countdown endsAt={s.countdown_ends_at} totalSeconds={state.config.countdown_seconds} />}
            </div>
          )}
          <BidTicker bids={state.bids} teams={state.teams} currentAuctionPlayerId={s?.current_auction_player_id ?? null} />

          {s?.phase === 'paused' && (
            <div className="text-center rounded-xl border border-gold bg-panel py-2 text-gold font-display">⏸ Auction Paused — bidders can&apos;t bid until you resume</div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HostButton label="Reveal Next" disabled={busy || !['ready', 'set_transition', 'sold', 'unsold'].includes(s?.phase ?? '')}
              onClick={() => handleRevealNext()} />
            <HostButton label="Start Bidding" disabled={busy || s?.phase !== 'player_reveal'}
              onClick={() => act(() => room.dispatch('startBidding'))} />
            <HostButton label="Sold" accent
              disabled={busy || !['bidding', 'countdown'].includes(s?.phase ?? '') || !s?.current_highest_team_id}
              onClick={() => act(() => room.dispatch('sold'))} />
            <HostButton label="Unsold" disabled={busy || !['bidding', 'countdown', 'player_reveal'].includes(s?.phase ?? '')}
              onClick={() => act(() => room.dispatch('unsold'))} />
            <HostButton label="Skip" disabled={busy || !currentPlayer}
              onClick={() => act(() => room.dispatch('skip'))} />
            <HostButton label={s?.is_paused ? 'Resume' : 'Pause'} disabled={busy}
              onClick={() => act(() => room.dispatch('phase', { phase: s?.is_paused ? 'bidding' : 'paused' }))} />
            <HostButton label="Undo" disabled={busy} onClick={() => act(() => room.dispatch('undo'))} />
            <HostButton
              label={`Requeue Unsold${unsoldCount ? ` (${unsoldCount})` : ''}`}
              disabled={busy || unsoldCount === 0}
              onClick={() => act(() => room.dispatch('requeueUnsold'))}
            />
          </div>

          <button onClick={() => setShowCorrect((v) => !v)} className="text-sm text-ink-muted underline">
            {showCorrect ? 'Hide' : 'Correct a mistake'}
          </button>
          {showCorrect && (
            <BidCorrector state={state} act={act} dispatch={room.dispatch} phase={s?.phase} highestTeam={highestTeam} />
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <TeamsOverview state={state} />
            <HistoryFeed state={state} onExpand={() => setShowHistory(true)} />
          </div>

          <div className="text-center">
            <button onClick={() => act(() => { room.dispatch('end'); router.push(`/results/${code}`); })} disabled={busy} className="text-sm text-ink-muted underline">
              End Auction &amp; View Results
            </button>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-4 pt-2 border-t border-line">
        <button onClick={() => setShowPlayers((v) => !v)} className="text-sm text-ink-muted underline">
          {showPlayers ? 'Hide' : 'Manage'} player pool ({state.players.length})
        </button>
        <button onClick={() => setShowSets((v) => !v)} className="text-sm text-ink-muted underline">
          {showSets ? 'Hide' : 'Manage'} auction sets ({state.auctionSets.length})
        </button>
        <button onClick={() => setShowHistory((v) => !v)} className="text-sm text-ink-muted underline">
          {showHistory ? 'Hide' : 'View'} full auction history
        </button>
      </div>
      {showSets && !preAuction && <SetManager state={state} act={act} dispatch={room.dispatch} />}
      {showHistory && <FullHistoryLog state={state} />}
      {showPlayers && <PlayerManager state={state} act={act} dispatch={room.dispatch} />}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 flex items-center justify-center px-6 text-center">{children}</main>;
}

function HostButton({ label, onClick, disabled, accent }: { label: string; onClick: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-xl border py-4 font-display text-lg transition-colors disabled:opacity-30 ${accent ? 'border-gold text-gold' : 'border-line text-ink hover:border-gold'}`}>
      {label}
    </button>
  );
}

type Dispatch = ReturnType<typeof useHostRoom>['dispatch'];

function LobbyManager({
  state, busy, act, dispatch, onStart, showConfig, setShowConfig, showSets, setShowSets,
}: {
  state: RoomState; busy: boolean; act: (fn: () => void) => void; dispatch: Dispatch; onStart: () => void;
  showConfig: boolean; setShowConfig: (v: boolean) => void; showSets: boolean; setShowSets: (v: boolean) => void;
}) {
  const hostAssign = state.config.team_assignment_mode === 'host_assign';
  const players = state.members.filter((m) => m.role !== 'spectator');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold bg-panel p-5 text-center">
        <div className="text-sm text-ink-muted">Share this code with your friends</div>
        <div className="font-display text-4xl text-gold mt-1 tracking-[0.2em]">{state.room.code}</div>
        <div className="text-xs text-ink-muted mt-2">Keep this tab open — it&apos;s what everyone else&apos;s phone connects to.</div>
      </div>

      {hostAssign ? (
        <div>
          <h2 className="font-display text-xl mb-2">Assign Franchises ({players.length} players)</h2>
          <div className="space-y-2">
            {players.length === 0 && <div className="text-sm text-ink-muted rounded-xl border border-line bg-panel p-4">Waiting for players to join…</div>}
            {players.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-panel p-3">
                <span className={m.is_ready ? 'text-emerald' : ''}>{m.display_name}</span>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-line bg-panel-raised px-2 py-1 text-sm"
                    value={m.team_id ?? ''}
                    onChange={(e) => act(() => dispatch('hostAssignTeam', { targetMemberId: m.id, teamId: e.target.value }))}
                  >
                    <option value="">— assign a franchise —</option>
                    {state.teams.map((t) => {
                      const takenBy = state.members.find((mm) => mm.id === t.owner_member_id);
                      const disabled = !!takenBy && takenBy.id !== m.id;
                      return <option key={t.id} value={t.id} disabled={disabled}>{t.franchise_code}{disabled ? ` (${takenBy!.display_name})` : ''}</option>;
                    })}
                  </select>
                  <button onClick={() => act(() => dispatch('removeMember', { targetId: m.id }))} className="text-xs text-crimson">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h2 className="font-display text-xl mb-2">Lobby ({players.length} players)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {state.teams.map((t) => {
              const occupant = state.members.find((m) => m.id === t.owner_member_id);
              return (
                <div key={t.id} className="rounded-xl border border-line bg-panel p-3">
                  <TeamBadge team={t} />
                  <div className="mt-2 text-sm truncate flex items-center justify-between">
                    <span className={occupant?.is_ready ? 'text-emerald' : 'text-ink-muted'}>{occupant ? occupant.display_name : 'Available'}</span>
                    {occupant && <button onClick={() => act(() => dispatch('removeMember', { targetId: occupant.id }))} className="text-xs text-crimson">✕</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <button onClick={() => setShowConfig(!showConfig)} className="text-sm text-ink-muted underline">{showConfig ? 'Hide' : 'Edit'} auction rules</button>
        <button onClick={() => setShowSets(!showSets)} className="text-sm text-ink-muted underline">{showSets ? 'Hide' : 'Edit'} auction sets</button>
      </div>
      {showConfig && <ConfigEditor config={state.config} dispatch={dispatch} hasPurchases={state.purchases.length > 0} />}
      {showSets && <SetManager state={state} act={act} dispatch={dispatch} />}

      <button onClick={onStart} disabled={busy} className="w-full rounded-xl bg-gold text-void font-display text-xl py-4 disabled:opacity-50">
        Start Auction
      </button>
    </div>
  );
}

function ConfigEditor({ config, dispatch, hasPurchases }: { config: AuctionConfig; dispatch: Dispatch; hasPurchases: boolean }) {
  const [local, setLocal] = useState(config);
  const [saved, setSaved] = useState(false);
  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  function save() {
    dispatch('updateConfig', {
      patch: {
        starting_purse_lakhs: local.starting_purse_lakhs,
        min_squad_size: local.min_squad_size,
        max_squad_size: local.max_squad_size,
        max_overseas: local.max_overseas,
        max_overseas_playing_xi: local.max_overseas_playing_xi,
        rtm_enabled: local.rtm_enabled,
        rtm_cards_per_team: local.rtm_cards_per_team,
        countdown_seconds: local.countdown_seconds,
        team_assignment_mode: local.team_assignment_mode,
        spectator_mode_enabled: local.spectator_mode_enabled,
        bid_increment_schedule: local.bid_increment_schedule,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateTier(i: number, patch: Partial<{ upTo: number | null; increment: number }>) {
    const next = local.bid_increment_schedule.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    setLocal({ ...local, bid_increment_schedule: next });
  }
  function addTier() {
    const tiers = local.bid_increment_schedule;
    // Base the new tier on the last *finite* tier (the array's final entry is always the upTo:null catch-all).
    const lastFinite = tiers.length >= 2 ? tiers[tiers.length - 2] : null;
    const nextUpTo = (lastFinite?.upTo ?? 0) + 100;
    const next = [...tiers];
    next.splice(next.length - 1, 0, { upTo: nextUpTo, increment: 25 });
    setLocal({ ...local, bid_increment_schedule: next });
  }
  function removeTier(i: number) {
    setLocal({ ...local, bid_increment_schedule: local.bid_increment_schedule.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 space-y-5 text-sm">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Starting purse (Cr)" value={local.starting_purse_lakhs / 100} step={5}
          onChange={(v) => setLocal({ ...local, starting_purse_lakhs: num(v) * 100 })} />
        <Field label="Countdown seconds" value={local.countdown_seconds} onChange={(v) => setLocal({ ...local, countdown_seconds: num(v) })} />
        <Field label="Min squad size" value={local.min_squad_size} onChange={(v) => setLocal({ ...local, min_squad_size: num(v) })} />
        <Field label="Max squad size" value={local.max_squad_size} onChange={(v) => setLocal({ ...local, max_squad_size: num(v) })} />
        <Field label="Max overseas players" value={local.max_overseas} onChange={(v) => setLocal({ ...local, max_overseas: num(v) })} />
        <Field label="Max overseas in Playing XI" value={local.max_overseas_playing_xi} onChange={(v) => setLocal({ ...local, max_overseas_playing_xi: num(v) })} />
        <Field label="RTM cards per team" value={local.rtm_cards_per_team} onChange={(v) => setLocal({ ...local, rtm_cards_per_team: num(v) })} />
      </div>

      {hasPurchases && <p className="text-xs text-crimson">Purse/RTM-card changes only apply before the first sale — bidding has already started.</p>}

      <div className="flex items-center justify-between">
        <span>RTM enabled</span>
        <Toggle checked={local.rtm_enabled} onChange={(v) => setLocal({ ...local, rtm_enabled: v })} label="RTM enabled" />
      </div>
      <div className="flex items-center justify-between">
        <span>Spectator mode</span>
        <Toggle checked={local.spectator_mode_enabled} onChange={(v) => setLocal({ ...local, spectator_mode_enabled: v })} label="Spectator mode" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Franchise assignment</span>
        <select
          className="rounded-lg border border-line bg-panel-raised px-3 py-2"
          value={local.team_assignment_mode}
          onChange={(e) => setLocal({ ...local, team_assignment_mode: e.target.value as AuctionConfig['team_assignment_mode'] })}
        >
          <option value="self_select">Players pick their own</option>
          <option value="host_assign">Host assigns them</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink-muted uppercase text-xs tracking-wide">Bid increments</span>
          <button onClick={addTier} className="text-xs text-gold underline">+ Add tier</button>
        </div>
        <div className="space-y-2">
          {local.bid_increment_schedule.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-ink-muted text-xs w-16">Up to</span>
              {tier.upTo == null ? (
                <span className="flex-1 rounded-lg border border-line bg-panel-raised px-3 py-2 text-ink-muted">any amount</span>
              ) : (
                <input type="number" value={tier.upTo} onChange={(e) => updateTier(i, { upTo: parseInt(e.target.value, 10) || 0 })}
                  className="flex-1 rounded-lg border border-line bg-panel-raised px-3 py-2" />
              )}
              <span className="text-ink-muted text-xs">L, +</span>
              <input type="number" value={tier.increment} onChange={(e) => updateTier(i, { increment: parseInt(e.target.value, 10) || 0 })}
                className="w-20 rounded-lg border border-line bg-panel-raised px-3 py-2" />
              <span className="text-ink-muted text-xs">L</span>
              {tier.upTo != null && local.bid_increment_schedule.length > 1 && (
                <button onClick={() => removeTier(i)} className="text-crimson text-xs">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} className="w-full rounded-lg border border-gold text-gold py-2">{saved ? 'Saved ✓' : 'Save rules'}</button>
    </div>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-muted">{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="rounded-lg border border-line bg-panel-raised px-3 py-2" />
    </label>
  );
}

function SetManager({ state, act, dispatch }: { state: RoomState; act: (fn: () => void) => void; dispatch: Dispatch }) {
  const [newName, setNewName] = useState('');
  const sorted = [...state.auctionSets].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 space-y-3">
      <h3 className="font-display text-lg">Auction Sets</h3>
      <div className="space-y-2">
        {sorted.map((set, i) => {
          const count = state.auctionPlayers.filter((ap) => ap.set_id === set.id).length;
          return (
            <div key={set.id} className="flex items-center gap-2 rounded-lg border border-line bg-panel-raised px-3 py-2">
              <Toggle checked={set.is_enabled} onChange={(v) => act(() => dispatch('toggleSetEnabled', { setId: set.id, enabled: v }))} label={`Enable ${set.name}`} />
              <input
                defaultValue={set.name}
                onBlur={(e) => e.target.value !== set.name && act(() => dispatch('renameSet', { setId: set.id, name: e.target.value }))}
                className="flex-1 bg-transparent border-b border-transparent hover:border-line focus:border-gold outline-none px-1 py-0.5 min-w-0"
              />
              <span className="text-xs text-ink-muted shrink-0">{count} players</span>
              <button disabled={i === 0} onClick={() => act(() => dispatch('reorderSet', { setId: set.id, direction: 'up' }))} className="text-ink-muted disabled:opacity-20 px-1">↑</button>
              <button disabled={i === sorted.length - 1} onClick={() => act(() => dispatch('reorderSet', { setId: set.id, direction: 'down' }))} className="text-ink-muted disabled:opacity-20 px-1">↓</button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New set name" className="flex-1 rounded-lg border border-line bg-panel-raised px-3 py-2 text-sm" />
        <button
          onClick={() => act(() => { dispatch('addSet', { name: newName }); setNewName(''); })}
          disabled={!newName.trim()}
          className="rounded-lg border border-gold text-gold px-4 py-2 text-sm disabled:opacity-40"
        >
          Add Set
        </button>
      </div>
    </div>
  );
}

function BidCorrector({
  state, act, dispatch, phase, highestTeam,
}: { state: RoomState; act: (fn: () => void) => void; dispatch: Dispatch; phase?: string; highestTeam: RoomState['teams'][number] | null }) {
  const [teamId, setTeamId] = useState(highestTeam?.id ?? '');
  const [amount, setAmount] = useState(state.auctionState.current_highest_bid_lakhs ?? 0);
  const canCorrect = phase === 'bidding' || phase === 'countdown';

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 space-y-3 text-sm">
      {!canCorrect ? (
        <p className="text-ink-muted">There&apos;s no active bid to correct right now.</p>
      ) : (
        <>
          <p className="text-ink-muted">Fix an accidental bid or a misheard call — this overrides the current highest bid directly.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rounded-lg border border-line bg-panel-raised px-3 py-2">
              <option value="">— team —</option>
              {state.teams.map((t) => <option key={t.id} value={t.id}>{t.franchise_code}</option>)}
            </select>
            <span className="text-ink-muted">₹</span>
            <input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)} className="w-28 rounded-lg border border-line bg-panel-raised px-3 py-2" />
            <span className="text-ink-muted">L</span>
            <button
              onClick={() => act(() => dispatch('hostCorrectBid', { teamId: teamId || null, amountLakhs: amount }))}
              disabled={!teamId}
              className="rounded-lg border border-gold text-gold px-4 py-2 disabled:opacity-40"
            >
              Apply Correction
            </button>
            <button onClick={() => act(() => dispatch('hostCorrectBid', { teamId: null, amountLakhs: null }))} className="rounded-lg border border-crimson text-crimson px-4 py-2">
              Clear Bid
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TeamsOverview({ state }: { state: RoomState }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <h3 className="font-display text-lg mb-2">Franchises</h3>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {state.teams.map((t) => {
          const count = state.purchases.filter((p) => p.team_id === t.id).length;
          return (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <TeamBadge team={t} size="sm" />
              <span className="text-ink-muted">{count} players</span>
              <span className="text-gold">{formatLakhs(t.purse_remaining_lakhs)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryFeed({ state, onExpand }: { state: RoomState; onExpand: () => void }) {
  const rows = [...state.purchases].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 8);
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg">Recent Sales</h3>
        {state.purchases.length > 8 && <button onClick={onExpand} className="text-xs text-gold underline">View all</button>}
      </div>
      <div className="space-y-1 max-h-72 overflow-y-auto text-sm">
        {rows.length === 0 && <div className="text-ink-muted">No sales yet.</div>}
        {rows.map((p) => {
          const player = state.players.find((pl) => pl.id === p.player_id);
          const team = state.teams.find((t) => t.id === p.team_id);
          return (
            <div key={p.id} className="flex items-center justify-between">
              <span className="truncate">{player?.full_name ?? '—'}</span>
              {team && <TeamBadge team={team} size="sm" />}
              <span className="text-gold">{formatLakhs(p.final_price_lakhs)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FullHistoryLog({ state }: { state: RoomState }) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  const rows = useMemo(() => {
    return [...state.purchases]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((p) => ({ purchase: p, player: state.players.find((pl) => pl.id === p.player_id), team: state.teams.find((t) => t.id === p.team_id) }))
      .filter((r) => !teamFilter || r.team?.id === teamFilter)
      .filter((r) => !search || r.player?.full_name.toLowerCase().includes(search.toLowerCase()));
  }, [state.purchases, state.players, state.teams, search, teamFilter]);

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 space-y-3">
      <h3 className="font-display text-lg">Full Auction History</h3>
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search player…" className="flex-1 rounded-lg border border-line bg-panel-raised px-3 py-2 text-sm min-w-[10rem]" />
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="rounded-lg border border-line bg-panel-raised px-3 py-2 text-sm">
          <option value="">All teams</option>
          {state.teams.map((t) => <option key={t.id} value={t.id}>{t.franchise_code}</option>)}
        </select>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-line text-sm">
        {rows.length === 0 && <div className="text-ink-muted py-4 text-center">No matching sales.</div>}
        {rows.map(({ purchase, player, team }) => (
          <div key={purchase.id} className="flex items-center justify-between py-2">
            <span className="truncate flex-1">{player?.full_name ?? '—'}</span>
            {team && <TeamBadge team={team} size="sm" />}
            <span className="text-gold w-24 text-right">{formatLakhs(purchase.final_price_lakhs)}</span>
            {purchase.used_rtm && <span className="text-emerald text-xs ml-2">RTM</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerManager({ state, act, dispatch }: { state: RoomState; act: (fn: () => void) => void; dispatch: Dispatch }) {
  const sortedSets = [...state.auctionSets].sort((a, b) => a.sort_order - b.sort_order);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'batter' | 'bowler' | 'all_rounder' | 'wicketkeeper'>('batter');
  const [base, setBase] = useState(20);
  const [setId, setSetId] = useState(sortedSets[0]?.id ?? '');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result)) as (Record<string, unknown> & { set?: string })[];
        const setIdByName = new Map(state.auctionSets.map((s) => [s.name, s.id]));
        raw.forEach(({ set, ...fields }) => {
          dispatch('addPlayer', { setId: (set && setIdByName.get(set)) ?? null, fields });
        });
        setImportMsg(`Imported ${raw.length} players.`);
      } catch {
        setImportMsg('Could not parse that file — expecting a JSON array of player objects.');
      }
    };
    reader.readAsText(file);
  }

  const filteredPlayers = state.players.filter((p) => !search || p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 space-y-3">
      <div className="grid sm:grid-cols-5 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" className="rounded-lg border border-line bg-panel-raised px-3 py-2 sm:col-span-2" />
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="rounded-lg border border-line bg-panel-raised px-3 py-2">
          <option value="batter">Batter</option>
          <option value="bowler">Bowler</option>
          <option value="all_rounder">All-Rounder</option>
          <option value="wicketkeeper">Wicketkeeper</option>
        </select>
        <input type="number" value={base} onChange={(e) => setBase(parseInt(e.target.value, 10) || 0)} placeholder="Base price (L)" className="rounded-lg border border-line bg-panel-raised px-3 py-2" />
        <select value={setId} onChange={(e) => setSetId(e.target.value)} className="rounded-lg border border-line bg-panel-raised px-3 py-2">
          {sortedSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => act(() => {
            dispatch('addPlayer', { setId: setId || null, fields: { full_name: name, primary_role: role, base_price_lakhs: base, rating_overall: 70, country: 'India', is_overseas: false, is_capped: true } });
            setName('');
          })}
          disabled={!name.trim()}
          className="rounded-lg border border-gold text-gold px-4 py-2 text-sm disabled:opacity-40"
        >
          Add custom player
        </button>
        <label className="rounded-lg border border-line px-4 py-2 text-sm cursor-pointer hover:border-gold transition-colors">
          Import players from JSON
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])} />
        </label>
        {importMsg && <span className="text-xs text-ink-muted">{importMsg}</span>}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${state.players.length} players…`} className="w-full rounded-lg border border-line bg-panel-raised px-3 py-2 text-sm" />

      <div className="max-h-80 overflow-y-auto divide-y divide-line">
        {filteredPlayers.map((p: Player) => (
          <div key={p.id} className="flex items-center justify-between py-2 text-sm gap-2">
            <span className="truncate flex-1">{p.full_name}</span>
            <select
              value={state.auctionPlayers.find((ap) => ap.player_id === p.id)?.set_id ?? ''}
              onChange={(e) => {
                const ap = state.auctionPlayers.find((a) => a.player_id === p.id);
                if (ap) act(() => dispatch('moveAuctionPlayerToSet', { auctionPlayerId: ap.id, setId: e.target.value || null }));
              }}
              className="rounded border border-line bg-panel-raised px-2 py-1 text-xs w-28"
            >
              <option value="">No set</option>
              {sortedSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input
              type="number"
              defaultValue={p.base_price_lakhs}
              onBlur={(e) => act(() => dispatch('updatePlayer', { playerId: p.id, patch: { base_price_lakhs: parseInt(e.target.value, 10) || p.base_price_lakhs } }))}
              className="w-20 rounded border border-line bg-panel-raised px-2 py-1"
            />
            <button
              onClick={() => { if (window.confirm(`Remove ${p.full_name} from the player pool?`)) act(() => dispatch('deletePlayer', { playerId: p.id })); }}
              className="text-crimson"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
