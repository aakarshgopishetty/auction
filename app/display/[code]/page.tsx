'use client';

import { use, useEffect } from 'react';
import { useClientRoom } from '@/lib/hooks/useClientRoom';
import { formatLakhs } from '@/lib/money';
import { PlayerCard } from '@/components/PlayerCard';
import { Countdown } from '@/components/Countdown';
import { TeamBadge } from '@/components/TeamBadge';
import { ResultStamp } from '@/components/ResultStamp';
import { BidTicker } from '@/components/BidTicker';
import { SoundToggle } from '@/components/SoundToggle';
import { useAuctionSounds } from '@/lib/hooks/useAuctionSounds';

export default function DisplayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const room = useClientRoom(code, { skipSavedSession: true });
  useAuctionSounds(room.state);

  useEffect(() => {
    if (room.status === 'idle') room.connect('Broadcast Display', 'spectator');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status]);

  if (!room.state) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="text-ink-muted">{room.error ?? `Connecting to ${code}…`}</span>
      </main>
    );
  }

  const state = room.state;
  const s = state.auctionState;
  const currentAP = state.auctionPlayers.find((ap) => ap.id === s.current_auction_player_id) ?? null;
  const currentPlayer = state.players.find((p) => p.id === currentAP?.player_id) ?? null;
  const highestTeam = state.teams.find((t) => t.id === s.current_highest_team_id) ?? null;
  const currentSet = state.auctionSets.find((set) => set.id === s.current_set_id) ?? null;
  const preAuction = ['lobby', 'configuring', 'ready'].includes(state.room.status);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-8 py-10 gap-8">
      <div className="fixed top-4 right-4">
        <SoundToggle defaultEnabled={state.config.sound_enabled_default} />
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.4em] text-gold">Auction Night</div>
        <div className="font-display text-2xl text-ink-muted">{code}{currentSet ? ` · ${currentSet.name}` : ''}</div>
      </div>

      {preAuction && (
        <div className="grid grid-cols-5 gap-4 w-full max-w-5xl">
          {state.teams.map((t) => {
            const occ = state.members.find((m) => m.id === t.owner_member_id);
            return (
              <div key={t.id} className="rounded-xl border border-line bg-panel p-4 text-center">
                <TeamBadge team={t} />
                <div className="mt-2 text-sm text-ink-muted">{occ ? occ.display_name : 'Waiting…'}</div>
              </div>
            );
          })}
        </div>
      )}

      {!preAuction && currentPlayer && (s.phase === 'sold' || s.phase === 'unsold') && (
        <ResultStamp outcome={s.phase} player={currentPlayer} team={highestTeam} price={s.current_highest_bid_lakhs} />
      )}

      {!preAuction && currentPlayer && s.phase !== 'sold' && s.phase !== 'unsold' && (
        <>
          <PlayerCard player={currentPlayer} />
          <div className="flex items-center gap-10">
            <div className="text-center">
              <div className="text-sm text-ink-muted uppercase">{s.current_highest_team_id ? 'Current Bid' : 'Opening'}</div>
              <div className="font-display text-6xl text-gold">{formatLakhs(s.current_highest_bid_lakhs ?? currentPlayer.base_price_lakhs)}</div>
              {highestTeam && <div className="mt-2 flex justify-center"><TeamBadge team={highestTeam} size="lg" /></div>}
            </div>
            {s.phase === 'countdown' && <Countdown endsAt={s.countdown_ends_at} totalSeconds={state.config.countdown_seconds} />}
          </div>
          <BidTicker bids={state.bids} teams={state.teams} currentAuctionPlayerId={s.current_auction_player_id} />
          {s.phase === 'paused' && <div className="font-display text-4xl text-gold">⏸ PAUSED</div>}
        </>
      )}

      {!preAuction && !currentPlayer && <div className="font-display text-3xl text-ink-muted">Next player coming up…</div>}

      <div className="fixed bottom-0 left-0 right-0 border-t border-line bg-panel/80 backdrop-blur px-6 py-3 flex gap-6 overflow-x-auto">
        {state.teams.map((t) => (
          <div key={t.id} className="flex items-center gap-2 shrink-0">
            <TeamBadge team={t} size="sm" />
            <span className="text-sm text-gold font-display">{formatLakhs(t.purse_remaining_lakhs)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
