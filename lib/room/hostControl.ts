import { createRoom } from './engine';
import { AuctionConfig } from '../types';
import { RoomStore, loadPersisted } from './store';
import { HostSession } from './hostSession';
import { getHostSession, setHostSession } from './hostSingleton';

export async function startHosting(hostName: string, overrides: Partial<AuctionConfig> = {}) {
  const { state } = createRoom(hostName, overrides);
  const store = new RoomStore(state);
  const session = new HostSession(store);
  await session.start();
  setHostSession(state.room.code, session);
  return { code: state.room.code, session };
}

/** Reuses the live singleton if this tab already has it, otherwise rebuilds a fresh host session from the last localStorage snapshot (e.g. after a host page refresh). Returns null if this device has never hosted this code. */
export async function resumeHosting(code: string): Promise<HostSession | null> {
  const existing = getHostSession(code);
  if (existing) return existing;

  const persisted = loadPersisted(code);
  if (!persisted) return null;

  const store = new RoomStore(persisted);
  const session = new HostSession(store);
  await session.start();
  setHostSession(code, session);
  return session;
}
