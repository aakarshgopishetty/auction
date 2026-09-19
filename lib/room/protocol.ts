import { MemberRole } from '../types';
import { RoomState } from './engine';

export type ClientToHost =
  | { kind: 'join'; displayName: string; role: MemberRole; existingMemberId?: string }
  | { kind: 'action'; type: string; memberId: string; args?: Record<string, unknown> }
  | { kind: 'ping' };

export type HostToClient =
  | { kind: 'welcome'; memberId: string; state: RoomState }
  | { kind: 'state'; state: RoomState }
  | { kind: 'error'; message: string; requestId?: string }
  | { kind: 'pong' };

/** Every action type the engine understands, dispatched the same way whether you're the host (direct call) or a bidder (sent over the wire). */
export const ACTION_TYPES = [
  'setReady', 'removeMember', 'claimTeam', 'updateConfig',
  'addPlayer', 'updatePlayer', 'deletePlayer',
  'startAuction', 'reveal', 'startBidding', 'bid', 'rtm', 'sold', 'unsold',
  'skip', 'undo', 'phase', 'jumpSet', 'end',
  'addSet', 'renameSet', 'toggleSetEnabled', 'reorderSet', 'moveAuctionPlayerToSet',
  'hostAssignTeam', 'hostCorrectBid', 'requeueUnsold',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
