import { StoredSession } from './types';

const KEY = 'auction-night:session';

export function saveSession(session: StoredSession) {
  if (typeof window === 'undefined') return;
  const all = loadAllSessions();
  all[session.roomCode] = session;
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function loadSession(roomCode: string): StoredSession | null {
  const all = loadAllSessions();
  return all[roomCode] ?? null;
}

export function clearSession(roomCode: string) {
  if (typeof window === 'undefined') return;
  const all = loadAllSessions();
  delete all[roomCode];
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

function loadAllSessions(): Record<string, StoredSession> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
