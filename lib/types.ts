export type RoomStatus = 'lobby' | 'configuring' | 'ready' | 'in_progress' | 'paused' | 'completed';

export type AuctionPhase =
  | 'lobby' | 'configuration' | 'ready' | 'not_started'
  | 'player_reveal' | 'bidding' | 'countdown' | 'sold' | 'unsold'
  | 'paused' | 'set_transition' | 'accelerated_auction' | 'completed';

export type MemberRole = 'host' | 'owner' | 'spectator';
export type PlayerRole = 'batter' | 'bowler' | 'all_rounder' | 'wicketkeeper';
export type AuctionPlayerStatus = 'pending' | 'current' | 'sold' | 'unsold' | 'skipped';

export interface Room {
  id: string;
  code: string;
  host_member_id: string | null;
  status: RoomStatus;
  created_at: string;
}

export interface AuctionConfig {
  room_id: string;
  starting_purse_lakhs: number;
  min_squad_size: number;
  max_squad_size: number;
  max_overseas: number;
  max_overseas_playing_xi: number;
  rtm_enabled: boolean;
  rtm_cards_per_team: number;
  bid_increment_schedule: { upTo: number | null; increment: number }[];
  countdown_seconds: number;
  spectator_mode_enabled: boolean;
  sound_enabled_default: boolean;
  accelerated_auction_enabled: boolean;
  unsold_round_enabled: boolean;
  team_assignment_mode: 'self_select' | 'host_assign';
}

export interface RoomMember {
  id: string;
  room_id: string;
  display_name: string;
  role: MemberRole;
  session_token: string;
  team_id: string | null;
  is_connected: boolean;
  is_ready: boolean;
  last_seen_at: string;
}

export interface Team {
  id: string;
  room_id: string;
  franchise_code: string;
  franchise_name: string;
  color_primary: string;
  color_secondary: string;
  owner_member_id: string | null;
  purse_total_lakhs: number;
  purse_remaining_lakhs: number;
  rtm_cards_remaining: number;
}

export interface Player {
  id: string;
  room_id: string;
  full_name: string;
  photo_url: string | null;
  country: string;
  is_overseas: boolean;
  is_capped: boolean;
  primary_role: PlayerRole;
  secondary_role: PlayerRole | null;
  batting_style: string | null;
  bowling_style: string | null;
  base_price_lakhs: number;
  rating_overall: number;
  rating_batting: number | null;
  rating_bowling: number | null;
  rating_fielding: number | null;
  rating_impact: number | null;
  ipl_matches: number;
  runs: number;
  batting_average: number | null;
  strike_rate: number | null;
  wickets: number;
  economy: number | null;
  recent_form_note: string | null;
  scouting_note: string | null;
  previous_team_hint: string | null;
}

export interface AuctionSet {
  id: string;
  room_id: string;
  name: string;
  sort_order: number;
  is_enabled: boolean;
  is_completed: boolean;
}

export interface AuctionPlayer {
  id: string;
  room_id: string;
  player_id: string;
  set_id: string | null;
  sequence_order: number;
  status: AuctionPlayerStatus;
}

export interface Bid {
  id: string;
  room_id: string;
  auction_player_id: string;
  team_id: string;
  amount_lakhs: number;
  server_seq: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  room_id: string;
  auction_player_id: string;
  player_id: string;
  team_id: string;
  final_price_lakhs: number;
  used_rtm: boolean;
  created_at: string;
}

export interface AuctionState {
  room_id: string;
  phase: AuctionPhase;
  current_set_id: string | null;
  current_auction_player_id: string | null;
  current_highest_bid_lakhs: number | null;
  current_highest_team_id: string | null;
  countdown_ends_at: string | null;
  is_paused: boolean;
  updated_at: string;
}

export interface AuctionEvent {
  id: string;
  room_id: string;
  server_seq: number;
  event_type: string;
  payload: Record<string, unknown>;
  is_undone: boolean;
  created_at: string;
}

/** What a bidder/spectator's browser stores in localStorage to reconnect to the host after a refresh. The host doesn't need one of these — its identity lives in the state itself as room.host_member_id. */
export interface StoredSession {
  roomCode: string;
  memberId: string;
  role: MemberRole;
  displayName: string;
}
