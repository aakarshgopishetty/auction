import { Player, Team } from '@/lib/types';
import { formatLakhs } from '@/lib/money';
import { TeamBadge } from './TeamBadge';

export function ResultStamp({
  outcome, player, team, price,
}: { outcome: 'sold' | 'unsold'; player: Player; team?: Team | null; price?: number | null }) {
  if (outcome === 'unsold') {
    return (
      <div className="animate-stamp flex flex-col items-center gap-3 rounded-2xl border-4 border-crimson px-10 py-8 bg-panel">
        <span className="font-display text-5xl tracking-widest" style={{ color: 'var(--crimson)' }}>UNSOLD</span>
        <span className="text-lg text-ink-muted">{player.full_name}</span>
      </div>
    );
  }
  return (
    <div className="animate-stamp flex flex-col items-center gap-3 rounded-2xl border-4 border-gold px-10 py-8 bg-panel">
      <span className="font-display text-5xl tracking-widest text-gold">SOLD!</span>
      <span className="font-display text-2xl">{player.full_name}</span>
      {team && <TeamBadge team={team} size="lg" />}
      {price != null && <span className="font-display text-3xl text-gold">{formatLakhs(price)}</span>}
    </div>
  );
}
