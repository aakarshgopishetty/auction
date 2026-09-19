import { RoomState } from './engine';

type Listener = (state: RoomState) => void;

export function storageKey(code: string) {
  return `auction-night:room:${code}`;
}

export function loadPersisted(code: string): RoomState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as RoomState) : null;
  } catch {
    return null;
  }
}

export class RoomStore {
  private listeners = new Set<Listener>();

  constructor(public state: RoomState) {}

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getSnapshot(): RoomState {
    return structuredClone(this.state);
  }

  /**
   * Runs an engine mutation against the live state, then persists +
   * notifies. Engine functions mutate `state` in place and either return
   * a value or throw an AuctionError — if they throw, we never reach
   * persist/notify, so a rejected action leaves the store untouched.
   */
  run<R, Args extends unknown[]>(fn: (state: RoomState, ...args: Args) => R, ...args: Args): R {
    const result = fn(this.state, ...args);
    this.persist();
    this.notifyAll();
    return result;
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(this.state.room.code), JSON.stringify(this.state));
    } catch {
      // storage full or unavailable — non-fatal, the in-memory state is still authoritative for this session
    }
  }

  private notifyAll() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snapshot));
  }
}
