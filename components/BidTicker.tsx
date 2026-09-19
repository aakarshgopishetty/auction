import { Bid, Team } from '@/lib/types';
import { formatLakhsCompact } from '@/lib/money';
import { TeamBadge } from './TeamBadge';

export function BidTicker({ bids, teams, currentAuctionPlayerId }: { bids: Bid[]; teams: Team[]; currentAuctionPlayerId: string | null }) {
  if (!currentAuctionPlayerId) return null;
  const recent = bids.filter((b) => b.auction_player_id === currentAuctionPlayerId).slice(0, 6);
  if (recent.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1">
      {recent.map((b) => {
        const team = teams.find((t) => t.id === b.team_id);
        if (!team) return null;
        return (
          <div key={b.id} className="flex items-center gap-1.5 shrink-0 rounded-full border border-line bg-panel-raised px-2.5 py-1 text-xs">
            <TeamBadge team={team} size="sm" />
            <span className="text-gold font-display">{formatLakhsCompact(b.amount_lakhs)}</span>
          </div>
        );
      })}
    </div>
  );
}
