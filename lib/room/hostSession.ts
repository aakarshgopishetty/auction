import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { RoomStore } from './store';
import * as engine from './engine';
import { peerIdForCode } from './engine';
import { ClientToHost, HostToClient, ActionType } from './protocol';
import { AuctionPhase } from '../types';

export type HostConnStatus = 'connecting' | 'open' | 'retrying' | 'error';

export class HostSession {
  peer: Peer | null = null;
  connections = new Map<string, DataConnection>(); // memberId -> connection
  status: HostConnStatus = 'connecting';
  lastError: string | null = null;
  onStatusChange?: (status: HostConnStatus, error?: string | null) => void;
  private unsubscribeStore: (() => void) | null = null;
  private retries = 0;

  constructor(public store: RoomStore) {}

  async start() {
    const PeerCtor = (await import('peerjs')).default;
    this.connectPeer(PeerCtor);
    this.unsubscribeStore = this.store.subscribe(() => this.broadcastAll());
  }

  private connectPeer(PeerCtor: typeof Peer) {
    const code = this.store.state.room.code;
    const peer = new PeerCtor(peerIdForCode(code));
    this.peer = peer;

    peer.on('open', () => {
      this.retries = 0;
      this.setStatus('open');
    });

    peer.on('error', (err: { type?: string; message: string }) => {
      // A just-refreshed host briefly still "owns" the old peer ID on PeerJS's
      // signaling server — a couple of short retries clears this up.
      if (err.type === 'unavailable-id' && this.retries < 4) {
        this.retries += 1;
        this.setStatus('retrying', err.message);
        peer.destroy();
        setTimeout(() => this.connectPeer(PeerCtor), 1500);
        return;
      }
      this.setStatus('error', err.message);
    });

    peer.on('connection', (conn) => this.handleConnection(conn));
  }

  private setStatus(status: HostConnStatus, error: string | null = null) {
    this.status = status;
    this.lastError = error;
    this.onStatusChange?.(status, error);
  }

  private handleConnection(conn: DataConnection) {
    let memberId: string | null = null;

    conn.on('data', (raw) => {
      const msg = raw as ClientToHost;

      if (msg.kind === 'join') {
        try {
          const known = msg.existingMemberId ? this.store.state.members.find((m) => m.id === msg.existingMemberId) : null;
          const member = known
            ? this.store.run(engine.reconnectMember, known.id)
            : this.store.run(engine.joinMember, msg.displayName, msg.role);
          memberId = member.id;
          // If this member already has a live connection (e.g. their old
          // tab hadn't noticed it was dead yet), close it explicitly
          // rather than leaving two connections pointing at one member.
          const prior = this.connections.get(member.id);
          if (prior && prior !== conn) {
            try { prior.close(); } catch { /* already gone */ }
          }
          this.connections.set(member.id, conn);
          this.send(conn, { kind: 'welcome', memberId: member.id, state: this.store.getSnapshot() });
        } catch (e) {
          this.send(conn, { kind: 'error', message: e instanceof Error ? e.message : 'Could not join.' });
        }
        return;
      }

      if (msg.kind === 'action') {
        try {
          this.dispatch(msg.type as ActionType, msg.memberId, msg.args ?? {});
        } catch (e) {
          this.send(conn, { kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
        }
        return;
      }

      if (msg.kind === 'ping') this.send(conn, { kind: 'pong' });
    });

    conn.on('close', () => {
      // Guard against a stale connection's close event firing after a
      // newer one has already taken over this member's slot — without
      // this check, an old tab finally noticing it's dead would wrongly
      // mark the member disconnected and delete their live connection.
      if (memberId && this.connections.get(memberId) === conn) {
        try { this.store.run(engine.markDisconnected, memberId); } catch { /* member may already be gone */ }
        this.connections.delete(memberId);
      }
    });
  }

  /** Also used directly by the host's own UI — no network round-trip needed for the host's own actions. */
  dispatch(type: ActionType, memberId: string, args: Record<string, unknown> = {}) {
    switch (type) {
      case 'setReady': return void this.store.run(engine.setReady, memberId, !!args.ready);
      case 'removeMember': return void this.store.run(engine.removeMember, args.targetId as string);
      case 'claimTeam': return void this.store.run(engine.claimTeam, memberId, args.teamId as string);
      case 'updateConfig': return void this.store.run(engine.updateConfig, args.patch as Record<string, unknown>);
      case 'addPlayer': return void this.store.run(engine.addPlayer, (args.setId as string) ?? null, args.fields as Record<string, unknown>);
      case 'updatePlayer': return void this.store.run(engine.updatePlayer, args.playerId as string, args.patch as Record<string, unknown>);
      case 'deletePlayer': return void this.store.run(engine.deletePlayer, args.playerId as string);
      case 'startAuction': return void this.store.run(engine.startAuction);
      case 'reveal': return void this.store.run(engine.revealPlayer, memberId, (args.auctionPlayerId as string) ?? null);
      case 'startBidding': return void this.store.run(engine.startBidding, memberId);
      case 'bid': return void this.store.run(engine.placeBid, memberId, args.auctionPlayerId as string | undefined);
      case 'rtm': return void this.store.run(engine.useRtm, memberId, args.auctionPlayerId as string | undefined);
      case 'sold': return void this.store.run(engine.markSold, memberId);
      case 'unsold': return void this.store.run(engine.markUnsold, memberId);
      case 'skip': return void this.store.run(engine.skipPlayer, memberId);
      case 'undo': return void this.store.run(engine.undoLastAction, memberId);
      case 'phase': return void this.store.run(engine.setRoomPhase, memberId, args.phase as AuctionPhase);
      case 'jumpSet': return void this.store.run(engine.jumpToSet, args.setId as string);
      case 'end': return void this.store.run(engine.endAuction);
      case 'addSet': return void this.store.run(engine.addSet, args.name as string);
      case 'renameSet': return void this.store.run(engine.renameSet, args.setId as string, args.name as string);
      case 'toggleSetEnabled': return void this.store.run(engine.toggleSetEnabled, args.setId as string, !!args.enabled);
      case 'reorderSet': return void this.store.run(engine.reorderSet, args.setId as string, args.direction as 'up' | 'down');
      case 'moveAuctionPlayerToSet': return void this.store.run(engine.moveAuctionPlayerToSet, args.auctionPlayerId as string, (args.setId as string) ?? null);
      case 'hostAssignTeam': return void this.store.run(engine.hostAssignTeam, memberId, args.targetMemberId as string, args.teamId as string);
      case 'hostCorrectBid': return void this.store.run(engine.hostCorrectBid, memberId, (args.teamId as string) ?? null, (args.amountLakhs as number) ?? null);
      case 'requeueUnsold': return void this.store.run(engine.requeueUnsold);
      default: throw new engine.AuctionError(`Unknown action: ${type}`);
    }
  }

  private send(conn: DataConnection, msg: HostToClient) {
    try { conn.send(msg); } catch { /* connection may have closed mid-send */ }
  }

  broadcastAll() {
    const state = this.store.getSnapshot();
    this.connections.forEach((conn) => this.send(conn, { kind: 'state', state }));
  }

  destroy() {
    this.unsubscribeStore?.();
    this.connections.clear();
    this.peer?.destroy();
  }
}
