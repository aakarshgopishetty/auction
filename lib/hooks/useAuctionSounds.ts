'use client';

import { useEffect, useRef } from 'react';
import { RoomState } from '../room/engine';
import { playBid, playReveal, playSold, playUnsold } from '../sound';

export function useAuctionSounds(state: RoomState | null) {
  const lastPhase = useRef<string | null>(null);
  const lastBidCount = useRef<number | null>(null);

  useEffect(() => {
    if (!state) return;
    const phase = state.auctionState.phase;
    const bidCount = state.bids.length;

    if (lastPhase.current !== null && phase !== lastPhase.current) {
      if (phase === 'sold') playSold();
      else if (phase === 'unsold') playUnsold();
      else if (phase === 'player_reveal') playReveal();
    }
    if (lastBidCount.current !== null && bidCount > lastBidCount.current) {
      playBid();
    }

    lastPhase.current = phase;
    lastBidCount.current = bidCount;
  }, [state?.auctionState.phase, state?.bids.length]);
}
