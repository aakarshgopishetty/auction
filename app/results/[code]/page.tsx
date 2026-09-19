'use client';

import { use, useEffect, useMemo } from 'react';
import { useClientRoom } from '@/lib/hooks/useClientRoom';
import { formatLakhs } from '@/lib/money';
import { TeamBadge } from '@/components/TeamBadge';
import { analyzeTeam, computeAwards, TeamPurchase } from '@/lib/engine/analysis';

export default function ResultsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const room = useClientRoom(code, { skipSavedSession: true });

  useEffect(() => {
    if (room.status === 'idle') room.connect('Results Viewer', 'spectator');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status]);

  const state = room.state;

  const analyses = useMemo(() => {
    if (!state) return [];
    return state.teams
      .map((team) => {
        const purchases: TeamPurchase[] = state.purchases
          .filter((p) => p.team_id === team.id)
          .map((p) => ({ ...p, player: state.players.find((pl) => pl.id === p.player_id)! }))
          .filter((p) => p.player);
        return analyzeTeam(team, purchases, state.config);
      })
      .sort((a, b) => b.scores.overall - a.scores.overall);
  }, [state]);

  const bidCountByTeam = useMemo(() => {
    const map: Record<string, number> = {};
    (state?.bids ?? []).forEach((b) => { map[b.team_id] = (map[b.team_id] ?? 0) + 1; });
    return map;
  }, [state]);

  const awards = useMemo(() => computeAwards(analyses, bidCountByTeam), [analyses, bidCountByTeam]);

  if (!state) {
    return <main className="flex-1 flex items-center justify-center"><span className="text-ink-muted">{room.error ?? `Connecting to ${code}…`}</span></main>;
  }

  const champion = analyses[0];

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-10 space-y-10">
      <header className="text-center">
        <div className="text-xs uppercase tracking-[0.4em] text-gold">Final Results</div>
        <h1 className="font-display text-4xl mt-2">{code}</h1>
        {champion && (
          <p className="mt-3 text-ink-muted">
            <span className="text-gold font-display text-xl">{champion.team.franchise_name}</span> built the
            best auction-night squad, scoring {champion.scores.overall}/100.
          </p>
        )}
      </header>

      {awards.length > 0 && (
        <section>
          <h2 className="font-display text-2xl mb-3">Awards</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {awards.map((a) => (
              <div key={a.title} className="rounded-xl border border-line bg-panel p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gold">{a.title}</div>
                  <div className="text-sm text-ink-muted mt-1">{a.reason}</div>
                </div>
                <TeamBadge team={a.team} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <h2 className="font-display text-2xl">Squad Analysis</h2>
        {analyses.map((a) => (
          <div key={a.team.id} className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <TeamBadge team={a.team} size="lg" />
                <span className="text-ink-muted text-sm">{a.purchases.length} players · {formatLakhs(a.team.purse_total_lakhs - a.team.purse_remaining_lakhs)} spent</span>
              </div>
              <div className="font-display text-3xl text-gold">{a.scores.overall}/100</div>
            </div>

            <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
              {Object.entries(a.scores).filter(([k]) => k !== 'overall').map(([k, v]) => (
                <div key={k} className="rounded-lg bg-panel-raised py-2">
                  <div className="font-display text-lg">{v}</div>
                  <div className="text-ink-muted capitalize">{k.replace(/([A-Z])/g, ' $1')}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-emerald text-xs uppercase tracking-wide mb-1">Strengths</div>
                <ul className="list-disc list-inside text-ink-muted space-y-0.5">{a.strengths.map((st) => <li key={st}>{st}</li>)}</ul>
              </div>
              <div>
                <div className="text-crimson text-xs uppercase tracking-wide mb-1">Weaknesses</div>
                <ul className="list-disc list-inside text-ink-muted space-y-0.5">{a.weaknesses.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            </div>

            <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
              {a.bestPurchase && <MiniStat label="Best Purchase" name={a.bestPurchase.player.full_name} value={formatLakhs(a.bestPurchase.final_price_lakhs)} />}
              {a.valuePurchase && <MiniStat label="Value Purchase" name={a.valuePurchase.player.full_name} value={formatLakhs(a.valuePurchase.final_price_lakhs)} />}
              {a.biggestOverpay && <MiniStat label="Biggest Overpay" name={a.biggestOverpay.player.full_name} value={formatLakhs(a.biggestOverpay.final_price_lakhs)} />}
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-ink-muted">Full squad</summary>
              <div className="mt-2 divide-y divide-line text-sm">
                {a.purchases.map((p) => (
                  <div key={p.id} className="flex justify-between py-1.5">
                    <span>{p.player.full_name}</span>
                    <span className="text-gold">{formatLakhs(p.final_price_lakhs)}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ))}
      </section>
    </main>
  );
}

function MiniStat({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-raised p-3">
      <div className="text-xs text-ink-muted uppercase">{label}</div>
      <div className="truncate">{name}</div>
      <div className="text-gold font-display">{value}</div>
    </div>
  );
}
