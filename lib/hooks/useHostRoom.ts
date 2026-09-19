'use client';

import { useEffect, useState, useCallback } from 'react';
import { RoomState } from '../room/engine';
import { HostSession, HostConnStatus } from '../room/hostSession';
import { resumeHosting } from '../room/hostControl';
import { ActionType } from '../room/protocol';

export interface UseHostRoomResult {
  state: RoomState | null;
  loading: boolean;
  error: string | null;
  connStatus: HostConnStatus | null;
  connError: string | null;
  hostMemberId: string | null;
  dispatch: (type: ActionType, args?: Record<string, unknown>) => void;
}

export function useHostRoom(code: string): UseHostRoomResult {
  const [session, setSession] = useState<HostSession | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [connStatus, setConnStatus] = useState<HostConnStatus | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      const s = await resumeHosting(code);
      if (cancelled) return;
      if (!s) {
        setError("This device doesn't have a host session for this room — open the control panel from the device that created it.");
        setLoading(false);
        return;
      }
      setSession(s);
      setState(s.store.getSnapshot());
      setConnStatus(s.status);
      setConnError(s.lastError);
      s.onStatusChange = (status, err) => {
        setConnStatus(status);
        setConnError(err ?? null);
      };
      unsub = s.store.subscribe((snap) => setState(snap));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [code]);

  const dispatch = useCallback(
    (type: ActionType, args: Record<string, unknown> = {}) => {
      if (!session || !state) return;
      session.dispatch(type, state.room.host_member_id!, args);
    },
    [session, state]
  );

  return { state, loading, error, connStatus, connError, hostMemberId: state?.room.host_member_id ?? null, dispatch };
}
