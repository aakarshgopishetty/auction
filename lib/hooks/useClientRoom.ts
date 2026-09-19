'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ClientSession, ClientConnStatus } from '../room/clientSession';
import { RoomState } from '../room/engine';
import { ActionType } from '../room/protocol';
import { MemberRole, StoredSession } from '../types';
import { loadSession, saveSession } from '../session';

export interface UseClientRoomResult {
  state: RoomState | null;
  status: ClientConnStatus | 'idle';
  error: string | null;
  memberId: string | null;
  savedSession: StoredSession | null;
  connect: (displayName: string, role: MemberRole) => void;
  dispatch: (type: ActionType, args?: Record<string, unknown>) => void;
}

export interface UseClientRoomOptions {
  /**
   * Display/results connections must never read or write the shared
   * per-room-code session slot — otherwise opening the broadcast
   * display on a device that's ever joined as a player would silently
   * reconnect AS that player, and then overwrite their saved session
   * with a fake "Broadcast Display" identity.
   */
  skipSavedSession?: boolean;
}

export function useClientRoom(code: string, opts: UseClientRoomOptions = {}): UseClientRoomResult {
  const { skipSavedSession = false } = opts;
  const sessionRef = useRef<ClientSession | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ClientConnStatus | 'idle'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);

  const connect = useCallback(
    (displayName: string, role: MemberRole) => {
      if (sessionRef.current) return;
      const existing = skipSavedSession ? null : loadSession(code);
      const cs = new ClientSession({ code, displayName, role, existingMemberId: existing?.memberId });
      cs.onStatusChange = (s, err) => {
        setStatus(s);
        setError(err ?? null);
      };
      cs.onState = (s) => setState(s);
      cs.onActionError = (msg) => setError(msg);
      cs.onWelcome = (id) => {
        setMemberId(id);
        if (skipSavedSession) return;
        const session: StoredSession = { roomCode: code, memberId: id, role, displayName };
        saveSession(session);
        setSavedSession(session);
      };
      sessionRef.current = cs;
      cs.start();
    },
    [code, skipSavedSession]
  );

  useEffect(() => {
    if (skipSavedSession) {
      return () => {
        sessionRef.current?.destroy();
        sessionRef.current = null;
      };
    }
    const existing = loadSession(code);
    setSavedSession(existing);
    if (existing) connect(existing.displayName, existing.role);
    return () => {
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, skipSavedSession]);

  const dispatch = useCallback((type: ActionType, args: Record<string, unknown> = {}) => {
    sessionRef.current?.dispatch(type, args);
  }, []);

  return { state, status, error, memberId, savedSession, connect, dispatch };
}
