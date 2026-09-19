import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { RoomState, peerIdForCode } from './engine';
import { ClientToHost, HostToClient, ActionType } from './protocol';
import { MemberRole } from '../types';

export type ClientConnStatus = 'connecting' | 'open' | 'error';

export interface ClientSessionOptions {
  code: string;
  displayName: string;
  role: MemberRole;
  existingMemberId?: string;
}

export class ClientSession {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  memberId: string | null = null;
  status: ClientConnStatus = 'connecting';
  lastError: string | null = null;
  state: RoomState | null = null;
  onStatusChange?: (status: ClientConnStatus, error?: string | null) => void;
  onState?: (state: RoomState) => void;
  onActionError?: (message: string) => void;
  onWelcome?: (memberId: string) => void;

  constructor(private opts: ClientSessionOptions) {}

  async start() {
    const PeerCtor = (await import('peerjs')).default;
    const peer = new PeerCtor();
    this.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(peerIdForCode(this.opts.code), { reliable: true });
      this.conn = conn;

      conn.on('open', () => {
        this.send({
          kind: 'join',
          displayName: this.opts.displayName,
          role: this.opts.role,
          existingMemberId: this.opts.existingMemberId,
        });
      });

      conn.on('data', (raw) => this.handleMessage(raw as HostToClient));
      conn.on('close', () => this.setStatus('error', 'Lost connection to the host.'));
      conn.on('error', (err: { message: string }) => this.setStatus('error', err.message));
    });

    peer.on('error', (err: { type?: string; message: string }) => {
      if (err.type === 'peer-unavailable') {
        this.setStatus('error', "Couldn't find that room — make sure the code is right and the host's screen is still open.");
      } else {
        this.setStatus('error', err.message);
      }
    });
  }

  private handleMessage(msg: HostToClient) {
    if (msg.kind === 'welcome') {
      this.memberId = msg.memberId;
      this.state = msg.state;
      this.setStatus('open');
      this.onWelcome?.(msg.memberId);
      this.onState?.(msg.state);
    } else if (msg.kind === 'state') {
      this.state = msg.state;
      this.onState?.(msg.state);
    } else if (msg.kind === 'error') {
      this.onActionError?.(msg.message);
    }
  }

  private setStatus(status: ClientConnStatus, error: string | null = null) {
    this.status = status;
    this.lastError = error;
    this.onStatusChange?.(status, error);
  }

  private send(msg: ClientToHost) {
    if (this.conn?.open) this.conn.send(msg);
  }

  dispatch(type: ActionType, args: Record<string, unknown> = {}) {
    if (!this.memberId) return;
    this.send({ kind: 'action', type, memberId: this.memberId, args });
  }

  destroy() {
    this.conn?.close();
    this.peer?.destroy();
  }
}
