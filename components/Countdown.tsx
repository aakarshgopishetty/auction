'use client';

import { useEffect, useState } from 'react';

export function Countdown({ endsAt, totalSeconds }: { endsAt: string | null; totalSeconds: number }) {
  const [now, setNow] = useState<number | null>(endsAt ? Date.now() : null);

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt || now == null) return null;

  const remaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  const pct = Math.max(0, Math.min(1, remaining / Math.max(totalSeconds, 1)));
  const urgent = remaining <= 3;

  return (
    <div className="flex flex-col items-center gap-1" role="timer" aria-live="polite">
      <div
        className="relative h-20 w-20 rounded-full flex items-center justify-center border-4 transition-colors"
        style={{ borderColor: urgent ? 'var(--crimson)' : 'var(--gold)' }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${urgent ? 'var(--crimson)' : 'var(--gold)'} ${pct * 360}deg, transparent 0deg)`,
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 6px))',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 6px))',
          }}
        />
        <span className="font-display text-3xl relative">{remaining}</span>
      </div>
    </div>
  );
}
