import { formatLakhs } from '@/lib/money';

export function PurseBar({
  remaining, total, squadCount, maxSquad,
}: { remaining: number; total: number; squadCount: number; maxSquad: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / Math.max(total, 1)) * 100));
  const low = pct < 20;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-muted">Purse remaining</span>
        <span className="font-display text-xl" style={{ color: low ? 'var(--crimson)' : 'var(--gold)' }}>
          {formatLakhs(remaining)}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-panel-raised overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: low ? 'var(--crimson)' : 'var(--gold)' }}
        />
      </div>
      <div className="mt-1 text-xs text-ink-muted">Squad {squadCount} / {maxSquad}</div>
    </div>
  );
}
