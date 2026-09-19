import {
  Room, AuctionConfig, RoomMember, Team, Player, AuctionSet, AuctionPlayer,
  Bid, Purchase, AuctionState, AuctionEvent, MemberRole,
} from '../types';
import { computeNextMinBid } from '../money';
import { maxLegalBid, roleCounts as roleCountsOf, overseasCount as overseasCountOf } from '../engine/squadRules';
import franchisesData from '../../data/franchises.json';
import defaultSetsData from '../../data/auction-sets.json';
import seedPlayersData from '../../data/seed-players.json';

export class AuctionError extends Error {}

export interface RoomState {
  room: Room;
  config: AuctionConfig;
  members: RoomMember[];
  teams: Team[];
  players: Player[];
  auctionSets: AuctionSet[];
  auctionPlayers: AuctionPlayer[];
  auctionState: AuctionState;
  bids: Bid[];
  purchases: Purchase[];
  events: AuctionEvent[];
  /** Set when the current highest bid came from an RTM match, cleared on every reveal. Kept outside auctionState since it's local bookkeeping, not part of the original schema. */
  rtmActiveTeamId: string | null;
}

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** The PeerJS peer ID a host registers under, derived from the human-readable room code. */
export function peerIdForCode(code: string): string {
  return 'auctionnight-' + code.toLowerCase();
}

export function createRoom(hostName: string, overrides: Partial<AuctionConfig> = {}): { state: RoomState; hostMemberId: string } {
  const roomId = uid();
  const code = randomCode();

  const config: AuctionConfig = {
    room_id: roomId,
    starting_purse_lakhs: 12000,
    min_squad_size: 18,
    max_squad_size: 25,
    max_overseas: 8,
    max_overseas_playing_xi: 4,
    rtm_enabled: true,
    rtm_cards_per_team: 1,
    bid_increment_schedule: [
      { upTo: 100, increment: 5 },
      { upTo: 200, increment: 10 },
      { upTo: 500, increment: 20 },
      { upTo: 1000, increment: 25 },
      { upTo: null, increment: 50 },
    ],
    countdown_seconds: 8,
    spectator_mode_enabled: true,
    sound_enabled_default: true,
    accelerated_auction_enabled: true,
    unsold_round_enabled: true,
    team_assignment_mode: 'self_select',
    ...overrides,
  };

  const teams: Team[] = (franchisesData as { code: string; name: string; primary: string; secondary: string }[]).map((f) => ({
    id: uid(),
    room_id: roomId,
    franchise_code: f.code,
    franchise_name: f.name,
    color_primary: f.primary,
    color_secondary: f.secondary,
    owner_member_id: null,
    purse_total_lakhs: config.starting_purse_lakhs,
    purse_remaining_lakhs: config.starting_purse_lakhs,
    rtm_cards_remaining: config.rtm_cards_per_team,
  }));

  const auctionSets: AuctionSet[] = (defaultSetsData as string[]).map((name, i) => ({
    id: uid(), room_id: roomId, name, sort_order: i, is_enabled: true, is_completed: false,
  }));
  const setIdByName = new Map(auctionSets.map((s) => [s.name, s.id]));

  const players: Player[] = [];
  const auctionPlayers: AuctionPlayer[] = [];
  (seedPlayersData as (Record<string, unknown> & { set: string })[]).forEach((raw, i) => {
    const { set, ...fields } = raw;
    const player = {
      id: uid(), room_id: roomId, photo_url: null, secondary_role: null, batting_style: null,
      bowling_style: null, runs: 0, wickets: 0, batting_average: null, strike_rate: null,
      economy: null, recent_form_note: null, scouting_note: null, previous_team_hint: null,
      ...fields,
    } as Player;
    players.push(player);
    auctionPlayers.push({
      id: uid(), room_id: roomId, player_id: player.id,
      set_id: setIdByName.get(set) ?? null, sequence_order: i, status: 'pending',
    });
  });

  const hostMemberId = uid();
  const hostMember: RoomMember = {
    id: hostMemberId, room_id: roomId, display_name: hostName, role: 'host',
    session_token: uid(), team_id: null, is_connected: true, is_ready: true, last_seen_at: nowIso(),
  };

  const room: Room = { id: roomId, code, host_member_id: hostMemberId, status: 'lobby', created_at: nowIso() };
  const auctionState: AuctionState = {
    room_id: roomId, phase: 'lobby', current_set_id: null, current_auction_player_id: null,
    current_highest_bid_lakhs: null, current_highest_team_id: null, countdown_ends_at: null,
    is_paused: false, updated_at: nowIso(),
  };

  return {
    state: { room, config, members: [hostMember], teams, players, auctionSets, auctionPlayers, auctionState, bids: [], purchases: [], events: [], rtmActiveTeamId: null },
    hostMemberId,
  };
}

// ── small internal helpers ──────────────────────────────────────────────────
function assertHost(state: RoomState, memberId: string) {
  const m = state.members.find((x) => x.id === memberId);
  if (!m || m.role !== 'host') throw new AuctionError('Only the host can do that.');
}
function findTeamOf(state: RoomState, memberId: string): Team {
  const member = state.members.find((m) => m.id === memberId);
  const team = state.teams.find((t) => t.id === member?.team_id);
  if (!team) throw new AuctionError('You are not assigned to a franchise.');
  return team;
}
function cheapestBasePrice(state: RoomState): number {
  return state.players.length ? Math.min(...state.players.map((p) => p.base_price_lakhs)) : 20;
}
function snapshotAuctionState(state: RoomState): AuctionState {
  return { ...state.auctionState };
}
function logEvent(state: RoomState, eventType: string, payload: Record<string, unknown>, before: AuctionState | null, memberId: string | null) {
  const event: AuctionEvent = {
    id: uid(), room_id: state.room.id, server_seq: state.events.length + 1,
    event_type: eventType, payload: { ...payload, _before: before }, is_undone: false, created_at: nowIso(),
  };
  state.events.unshift(event);
}

// ── Lobby / membership ───────────────────────────────────────────────────────
export function joinMember(state: RoomState, displayName: string, role: MemberRole): RoomMember {
  const member: RoomMember = {
    id: uid(), room_id: state.room.id, display_name: displayName.slice(0, 40) || 'Player',
    role, session_token: uid(), team_id: null, is_connected: true, is_ready: false, last_seen_at: nowIso(),
  };
  state.members.push(member);
  return member;
}

export function reconnectMember(state: RoomState, memberId: string): RoomMember {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) throw new AuctionError('That session is no longer recognized by this host.');
  member.is_connected = true;
  member.last_seen_at = nowIso();
  return member;
}

export function markDisconnected(state: RoomState, memberId: string) {
  const member = state.members.find((m) => m.id === memberId);
  if (member) { member.is_connected = false; member.last_seen_at = nowIso(); }
}

export function setReady(state: RoomState, memberId: string, ready: boolean) {
  const member = state.members.find((m) => m.id === memberId);
  if (member) member.is_ready = ready;
}

export function removeMember(state: RoomState, memberId: string) {
  state.teams.forEach((t) => { if (t.owner_member_id === memberId) t.owner_member_id = null; });
  state.members = state.members.filter((m) => m.id !== memberId);
}

export function claimTeam(state: RoomState, memberId: string, teamId: string) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) throw new AuctionError('That franchise does not exist.');
  if (team.owner_member_id && team.owner_member_id !== memberId) {
    throw new AuctionError('That franchise has already been taken.');
  }
  state.teams.forEach((t) => { if (t.owner_member_id === memberId) t.owner_member_id = null; });
  team.owner_member_id = memberId;
  const member = state.members.find((m) => m.id === memberId);
  if (member) member.team_id = teamId;
}

export function updateConfig(state: RoomState, patch: Partial<AuctionConfig>) {
  const purseChanged = patch.starting_purse_lakhs != null && patch.starting_purse_lakhs !== state.config.starting_purse_lakhs;
  Object.assign(state.config, patch);
  // Safe to cascade the new purse to every team only if nobody has bought anything yet.
  if (purseChanged && state.purchases.length === 0) {
    state.teams.forEach((t) => {
      t.purse_total_lakhs = state.config.starting_purse_lakhs;
      t.purse_remaining_lakhs = state.config.starting_purse_lakhs;
    });
  }
  if (patch.rtm_cards_per_team != null && state.purchases.length === 0) {
    state.teams.forEach((t) => { t.rtm_cards_remaining = state.config.rtm_cards_per_team; });
  }
}

// ── Player pool management ──────────────────────────────────────────────────
export function addPlayer(state: RoomState, setId: string | null, fields: Partial<Player>): Player {
  const player: Player = {
    id: uid(), room_id: state.room.id, photo_url: null, country: 'India', is_overseas: false, is_capped: true,
    secondary_role: null, batting_style: null, bowling_style: null, base_price_lakhs: 20, rating_overall: 70,
    rating_batting: null, rating_bowling: null, rating_fielding: null, rating_impact: null, ipl_matches: 0,
    runs: 0, batting_average: null, strike_rate: null, wickets: 0, economy: null, recent_form_note: null,
    scouting_note: null, previous_team_hint: null,
    full_name: 'New Player', primary_role: 'batter',
    ...fields,
  };
  state.players.push(player);
  const nextSeq = Math.max(-1, ...state.auctionPlayers.map((a) => a.sequence_order)) + 1;
  state.auctionPlayers.push({
    id: uid(), room_id: state.room.id, player_id: player.id, set_id: setId,
    sequence_order: nextSeq, status: 'pending',
  });
  return player;
}

export function updatePlayer(state: RoomState, playerId: string, patch: Partial<Player>) {
  const player = state.players.find((p) => p.id === playerId);
  if (player) Object.assign(player, patch);
}

export function deletePlayer(state: RoomState, playerId: string) {
  state.players = state.players.filter((p) => p.id !== playerId);
  state.auctionPlayers = state.auctionPlayers.filter((ap) => ap.player_id !== playerId);
}

// ── Auction flow ─────────────────────────────────────────────────────────────
export function startAuction(state: RoomState) {
  const firstSet = state.auctionSets.filter((s) => s.is_enabled).sort((a, b) => a.sort_order - b.sort_order)[0];
  state.room.status = 'in_progress';
  state.auctionState.phase = 'ready';
  state.auctionState.current_set_id = firstSet?.id ?? null;
  state.auctionState.updated_at = nowIso();
}

export function revealPlayer(state: RoomState, memberId: string, auctionPlayerId: string | null) {
  assertHost(state, memberId);
  let next: AuctionPlayer | undefined;
  if (auctionPlayerId) {
    next = state.auctionPlayers.find((ap) => ap.id === auctionPlayerId);
  } else {
    next = state.auctionPlayers
      .filter((ap) => ap.status === 'pending' && (!state.auctionState.current_set_id || ap.set_id === state.auctionState.current_set_id))
      .sort((a, b) => a.sequence_order - b.sequence_order)[0];
  }
  if (!next) throw new AuctionError('No players remaining in this set.');

  const before = snapshotAuctionState(state);
  next.status = 'current';
  state.rtmActiveTeamId = null;
  Object.assign(state.auctionState, {
    current_auction_player_id: next.id, current_highest_bid_lakhs: null, current_highest_team_id: null,
    phase: 'player_reveal', countdown_ends_at: null, updated_at: nowIso(),
  });
  logEvent(state, 'REVEAL', { auction_player_id: next.id }, before, memberId);
}

export function startBidding(state: RoomState, memberId: string) {
  assertHost(state, memberId);
  if (state.auctionState.phase !== 'player_reveal') throw new AuctionError('No player is currently up for reveal.');
  const before = snapshotAuctionState(state);
  state.auctionState.phase = 'bidding';
  state.auctionState.updated_at = nowIso();
  logEvent(state, 'PHASE_CHANGE', { to: 'bidding' }, before, memberId);
}

export function placeBid(state: RoomState, memberId: string, expectedAuctionPlayerId?: string) {
  const s = state.auctionState;
  if (!['bidding', 'countdown'].includes(s.phase)) {
    throw new AuctionError(s.phase === 'paused' ? 'Auction is currently paused.' : 'Bidding is not open right now.');
  }
  if (expectedAuctionPlayerId && expectedAuctionPlayerId !== s.current_auction_player_id) {
    throw new AuctionError('This player is already sold — the auction has moved on.');
  }

  const team = findTeamOf(state, memberId);
  if (s.current_highest_team_id === team.id) throw new AuctionError('Your team already holds the highest bid.');

  const ap = state.auctionPlayers.find((a) => a.id === s.current_auction_player_id);
  const player = state.players.find((p) => p.id === ap?.player_id);
  if (!player) throw new AuctionError('No player is currently up for auction.');

  const amount = computeNextMinBid(s.current_highest_bid_lakhs, player.base_price_lakhs, state.config.bid_increment_schedule);
  const squadCount = state.purchases.filter((p) => p.team_id === team.id).length;

  if (squadCount >= state.config.max_squad_size) {
    throw new AuctionError(`Bid blocked: ${team.franchise_code} cannot bid because its squad is already at the maximum size.`);
  }
  if (player.is_overseas) {
    const overseas = state.purchases.filter((p) => p.team_id === team.id && state.players.find((pl) => pl.id === p.player_id)?.is_overseas).length;
    if (overseas >= state.config.max_overseas) {
      throw new AuctionError('Bid blocked: this purchase would exceed the maximum overseas-player limit.');
    }
  }
  if (amount > team.purse_remaining_lakhs) {
    throw new AuctionError(`Bid blocked: ${team.franchise_code} does not have enough purse remaining.`);
  }
  if (amount > maxLegalBid(team, squadCount, state.config, cheapestBasePrice(state))) {
    throw new AuctionError(`Bid blocked: this bid would leave ${team.franchise_code} unable to fill its minimum squad size.`);
  }

  const before = snapshotAuctionState(state);
  const bid: Bid = { id: uid(), room_id: state.room.id, auction_player_id: ap!.id, team_id: team.id, amount_lakhs: amount, server_seq: state.bids.length + 1, created_at: nowIso() };
  state.bids.unshift(bid);
  state.rtmActiveTeamId = null;
  Object.assign(s, {
    current_highest_bid_lakhs: amount, current_highest_team_id: team.id, phase: 'countdown',
    countdown_ends_at: new Date(Date.now() + state.config.countdown_seconds * 1000).toISOString(), updated_at: nowIso(),
  });
  logEvent(state, 'BID', { bid_id: bid.id, team_id: team.id, amount }, before, memberId);
}

export function useRtm(state: RoomState, memberId: string, expectedAuctionPlayerId?: string) {
  const s = state.auctionState;
  if (s.phase === 'paused') throw new AuctionError('Auction is currently paused.');
  if (!['bidding', 'countdown'].includes(s.phase) || !s.current_highest_team_id) {
    throw new AuctionError('RTM is not available right now.');
  }
  if (expectedAuctionPlayerId && expectedAuctionPlayerId !== s.current_auction_player_id) {
    throw new AuctionError('This player is already sold — the auction has moved on.');
  }
  const team = findTeamOf(state, memberId);
  if (team.id === s.current_highest_team_id) throw new AuctionError('Your team already holds the highest bid.');
  if (team.rtm_cards_remaining <= 0) throw new AuctionError(`RTM is not available: ${team.franchise_code} has no RTM cards left.`);

  const ap = state.auctionPlayers.find((a) => a.id === s.current_auction_player_id);
  const player = state.players.find((p) => p.id === ap?.player_id);
  if (!player || player.previous_team_hint !== team.franchise_code) {
    throw new AuctionError(`RTM is not available: ${player?.full_name ?? 'this player'} was not previously with ${team.franchise_code}.`);
  }

  const before = snapshotAuctionState(state);
  team.rtm_cards_remaining -= 1;
  state.rtmActiveTeamId = team.id;
  Object.assign(s, {
    current_highest_team_id: team.id, phase: 'countdown',
    countdown_ends_at: new Date(Date.now() + state.config.countdown_seconds * 1000).toISOString(), updated_at: nowIso(),
  });
  logEvent(state, 'RTM_USED', { team_id: team.id }, before, memberId);
}

export function markSold(state: RoomState, memberId: string) {
  assertHost(state, memberId);
  const s = state.auctionState;
  if (!['bidding', 'countdown'].includes(s.phase) || !s.current_highest_team_id) {
    throw new AuctionError('There is no valid bid to sell to.');
  }
  const before = snapshotAuctionState(state);
  const team = state.teams.find((t) => t.id === s.current_highest_team_id)!;
  const ap = state.auctionPlayers.find((a) => a.id === s.current_auction_player_id)!;

  team.purse_remaining_lakhs -= s.current_highest_bid_lakhs!;
  const usedRtm = state.rtmActiveTeamId === team.id;
  const purchase: Purchase = {
    id: uid(), room_id: state.room.id, auction_player_id: ap.id, player_id: ap.player_id,
    team_id: team.id, final_price_lakhs: s.current_highest_bid_lakhs!, used_rtm: !!usedRtm, created_at: nowIso(),
  };
  state.purchases.push(purchase);
  ap.status = 'sold';
  s.phase = 'sold';
  s.updated_at = nowIso();
  logEvent(state, 'SOLD', { purchase_id: purchase.id, auction_player_id: ap.id }, before, memberId);
}

export function markUnsold(state: RoomState, memberId: string) {
  assertHost(state, memberId);
  const s = state.auctionState;
  if (!['bidding', 'countdown', 'player_reveal'].includes(s.phase)) throw new AuctionError('There is no active player to mark unsold.');
  const before = snapshotAuctionState(state);
  const ap = state.auctionPlayers.find((a) => a.id === s.current_auction_player_id);
  if (ap) ap.status = 'unsold';
  s.phase = 'unsold';
  s.updated_at = nowIso();
  logEvent(state, 'UNSOLD', { auction_player_id: ap?.id }, before, memberId);
}

export function skipPlayer(state: RoomState, memberId: string) {
  assertHost(state, memberId);
  if (!state.auctionState.current_auction_player_id) throw new AuctionError('No active player to skip.');
  const before = snapshotAuctionState(state);
  const ap = state.auctionPlayers.find((a) => a.id === state.auctionState.current_auction_player_id);
  if (ap) {
    ap.status = 'pending';
    ap.sequence_order = Math.max(0, ...state.auctionPlayers.map((x) => x.sequence_order)) + 1;
  }
  Object.assign(state.auctionState, { phase: 'ready', current_auction_player_id: null, current_highest_bid_lakhs: null, current_highest_team_id: null, updated_at: nowIso() });
  logEvent(state, 'SKIP', { auction_player_id: ap?.id }, before, memberId);
}

export function setRoomPhase(state: RoomState, memberId: string, phase: AuctionState['phase']) {
  assertHost(state, memberId);
  const before = snapshotAuctionState(state);
  state.auctionState.phase = phase;
  state.auctionState.is_paused = phase === 'paused';
  state.auctionState.updated_at = nowIso();
  logEvent(state, 'PHASE_CHANGE', { to: phase }, before, memberId);
}

export function jumpToSet(state: RoomState, setId: string) {
  state.auctionState.phase = 'ready';
  state.auctionState.current_set_id = setId;
  state.auctionState.updated_at = nowIso();
}

export function endAuction(state: RoomState) {
  state.room.status = 'completed';
  state.auctionState.phase = 'completed';
  state.auctionState.updated_at = nowIso();
}

export function undoLastAction(state: RoomState, memberId: string) {
  assertHost(state, memberId);
  const event = state.events.find((e) => !e.is_undone);
  if (!event) throw new AuctionError('Nothing to undo.');
  if (event.event_type === 'UNDO') throw new AuctionError('You cannot undo an undo.');

  const before = event.payload._before as AuctionState;

  if (event.event_type === 'BID') {
    state.bids = state.bids.filter((b) => b.id !== event.payload.bid_id);
  } else if (event.event_type === 'RTM_USED') {
    const team = state.teams.find((t) => t.id === event.payload.team_id);
    if (team) team.rtm_cards_remaining += 1;
  } else if (event.event_type === 'SOLD') {
    const team = state.teams.find((t) => t.id === before.current_highest_team_id);
    if (team) team.purse_remaining_lakhs += before.current_highest_bid_lakhs ?? 0;
    state.purchases = state.purchases.filter((p) => p.id !== event.payload.purchase_id);
    const ap = state.auctionPlayers.find((a) => a.id === event.payload.auction_player_id);
    if (ap) ap.status = 'current';
  } else if (event.event_type === 'UNSOLD') {
    const ap = state.auctionPlayers.find((a) => a.id === event.payload.auction_player_id);
    if (ap) ap.status = 'current';
  } else if (event.event_type === 'REVEAL') {
    const ap = state.auctionPlayers.find((a) => a.id === event.payload.auction_player_id);
    if (ap) ap.status = 'pending';
  } else if (event.event_type === 'SKIP') {
    const ap = state.auctionPlayers.find((a) => a.id === event.payload.auction_player_id);
    if (ap) ap.status = 'current';
  }

  Object.assign(state.auctionState, before);
  event.is_undone = true;
  logEvent(state, 'UNDO', { undid_event_id: event.id, undid_type: event.event_type }, null, memberId);
}

export { roleCountsOf as roleCounts, overseasCountOf as overseasCount };

// ── Extra host controls: set management, host-assign, bid correction, requeue ──

export function addSet(state: RoomState, name: string) {
  const maxOrder = Math.max(-1, ...state.auctionSets.map((s) => s.sort_order));
  state.auctionSets.push({ id: uid(), room_id: state.room.id, name: name.slice(0, 40) || 'New Set', sort_order: maxOrder + 1, is_enabled: true, is_completed: false });
}

export function renameSet(state: RoomState, setId: string, name: string) {
  const set = state.auctionSets.find((s) => s.id === setId);
  if (set) set.name = name.slice(0, 40) || set.name;
}

export function toggleSetEnabled(state: RoomState, setId: string, enabled: boolean) {
  const set = state.auctionSets.find((s) => s.id === setId);
  if (set) set.is_enabled = enabled;
}

export function reorderSet(state: RoomState, setId: string, direction: 'up' | 'down') {
  const sorted = [...state.auctionSets].sort((a, b) => a.sort_order - b.sort_order);
  const idx = sorted.findIndex((s) => s.id === setId);
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= sorted.length) return;
  const a = sorted[idx];
  const b = sorted[swapWith];
  const tmp = a.sort_order;
  a.sort_order = b.sort_order;
  b.sort_order = tmp;
}

export function moveAuctionPlayerToSet(state: RoomState, auctionPlayerId: string, setId: string | null) {
  const ap = state.auctionPlayers.find((a) => a.id === auctionPlayerId);
  if (!ap) return;
  ap.set_id = setId;
  // Send it to the back of the destination set's queue rather than keeping
  // its old ordering value, which could otherwise put it anywhere —
  // including jumping the queue — in the new set.
  const maxInDestination = Math.max(-1, ...state.auctionPlayers.filter((a) => a.set_id === setId && a.id !== ap.id).map((a) => a.sequence_order));
  ap.sequence_order = maxInDestination + 1;
}

/** Host assigns a franchise directly to another member — for team_assignment_mode: 'host_assign'. */
export function hostAssignTeam(state: RoomState, hostMemberId: string, targetMemberId: string, teamId: string) {
  assertHost(state, hostMemberId);
  claimTeam(state, targetMemberId, teamId);
}

/**
 * Host manually corrects the current bid — for fixing a fat-finger tap or
 * a misheard call at the table. Deliberately bypasses the normal
 * increment/purse/squad checks (that's the point of a correction tool),
 * but still guards against nonsense values.
 */
export function hostCorrectBid(state: RoomState, memberId: string, teamId: string | null, amountLakhs: number | null) {
  assertHost(state, memberId);
  const s = state.auctionState;
  if (!['bidding', 'countdown'].includes(s.phase)) throw new AuctionError('There is no active bid to correct.');

  if (teamId === null) {
    // Clear the current bid entirely (back to base price, no bidder).
    const before = snapshotAuctionState(state);
    Object.assign(s, { current_highest_bid_lakhs: null, current_highest_team_id: null, countdown_ends_at: null, phase: 'bidding' });
    logEvent(state, 'PHASE_CHANGE', { to: 'bid_cleared_by_host' }, before, memberId);
    return;
  }

  const team = state.teams.find((t) => t.id === teamId);
  if (!team) throw new AuctionError('That franchise does not exist.');
  if (amountLakhs == null || amountLakhs <= 0) throw new AuctionError('Enter a valid corrected amount.');
  if (amountLakhs > team.purse_remaining_lakhs) throw new AuctionError(`${team.franchise_code} does not have that much purse remaining.`);

  const before = snapshotAuctionState(state);
  Object.assign(s, { current_highest_bid_lakhs: amountLakhs, current_highest_team_id: team.id, updated_at: nowIso() });
  logEvent(state, 'PHASE_CHANGE', { to: 'bid_corrected_by_host', team_id: team.id, amount: amountLakhs }, before, memberId);
}

/** Sends every currently-UNSOLD player into the "Unsold Players" set (or the room's last enabled set if none exists) for a re-auction round. */
export function requeueUnsold(state: RoomState) {
  const bySortOrder = [...state.auctionSets].sort((a, b) => a.sort_order - b.sort_order);
  const targetSet = bySortOrder.find((s) => /unsold/i.test(s.name)) ?? bySortOrder[bySortOrder.length - 1];
  const unsold = state.auctionPlayers.filter((ap) => ap.status === 'unsold');
  let seq = Math.max(0, ...state.auctionPlayers.map((a) => a.sequence_order)) + 1;
  unsold.forEach((ap) => {
    ap.status = 'pending';
    ap.set_id = targetSet?.id ?? ap.set_id;
    ap.sequence_order = seq++;
  });
  if (targetSet) targetSet.is_enabled = true;
  return unsold.length;
}
