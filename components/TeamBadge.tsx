import { Team } from '@/lib/types';

export function TeamBadge({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'h-6 px-2 text-xs' : size === 'lg' ? 'h-10 px-4 text-base' : 'h-8 px-3 text-sm';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-display tracking-wide ${dims}`}
      style={{ background: `${team.color_primary}22`, border: `1px solid ${team.color_primary}`, color: team.color_primary }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: team.color_primary }} />
      {team.franchise_code}
    </span>
  );
}
