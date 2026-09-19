import { Player } from '@/lib/types';
import { formatLakhs } from '@/lib/money';

const ROLE_LABEL: Record<string, string> = {
  batter: 'Batter',
  bowler: 'Bowler',
  all_rounder: 'All-Rounder',
  wicketkeeper: 'Wicketkeeper',
};

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function PlayerCard({ player, animate = true }: { player: Player; animate?: boolean }) {
  return (
    <div className={`w-full max-w-2xl rounded-2xl border border-line bg-panel overflow-hidden ${animate ? 'animate-reveal' : ''}`}>
      <div className="flex items-stretch gap-6 p-6 sm:p-8">
        <div className="shrink-0">
          {player.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.photo_url} alt={player.full_name} className="h-28 w-28 sm:h-36 sm:w-36 rounded-xl object-cover border border-line" />
          ) : (
            <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-xl bg-panel-raised border border-line flex items-center justify-center">
              <span className="font-display text-3xl sm:text-4xl text-gold">{initials(player.full_name)}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span>{player.country}</span>
            <span className="h-1 w-1 rounded-full bg-ink-muted" />
            <span>{player.is_overseas ? 'Overseas' : 'Indian'}</span>
            <span className="h-1 w-1 rounded-full bg-ink-muted" />
            <span>{player.is_capped ? 'Capped' : 'Uncapped'}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl leading-tight mt-1 truncate">{player.full_name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-line bg-panel-raised px-3 py-1 text-sm">
              {ROLE_LABEL[player.primary_role]}{player.secondary_role ? ` / ${ROLE_LABEL[player.secondary_role]}` : ''}
            </span>
            {player.batting_style && (
              <span className="rounded-full border border-line bg-panel-raised px-3 py-1 text-sm text-ink-muted">{player.batting_style}</span>
            )}
            {player.bowling_style && (
              <span className="rounded-full border border-line bg-panel-raised px-3 py-1 text-sm text-ink-muted">{player.bowling_style}</span>
            )}
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-ink-muted">Base price</div>
            <div className="font-display text-2xl sm:text-3xl text-gold">{formatLakhs(player.base_price_lakhs)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-line border-t border-line">
        {[
          ['Overall', player.rating_overall],
          ['Batting', player.rating_batting],
          ['Bowling', player.rating_bowling],
          ['Fielding', player.rating_fielding],
        ].map(([label, val]) => (
          <div key={label as string} className="px-3 py-3 text-center">
            <div className="text-xs text-ink-muted">{label}</div>
            <div className="font-display text-xl">{val ?? '—'}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border-t border-line text-sm">
        <Stat label="Matches" value={player.ipl_matches} />
        {player.primary_role !== 'bowler' && <Stat label="Runs" value={player.runs} />}
        {player.batting_average != null && <Stat label="Average" value={player.batting_average} />}
        {player.strike_rate != null && <Stat label="Strike Rate" value={player.strike_rate} />}
        {player.wickets > 0 && <Stat label="Wickets" value={player.wickets} />}
        {player.economy != null && <Stat label="Economy" value={player.economy} />}
      </div>

      {player.recent_form_note && (
        <div className="px-6 py-3 border-t border-line text-sm text-ink-muted italic">{player.recent_form_note}</div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-panel px-3 py-3 text-center">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="font-display text-lg">{value}</div>
    </div>
  );
}
