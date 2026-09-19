'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startHosting } from '@/lib/room/hostControl';
import { Toggle } from '@/components/Toggle';

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [purseCr, setPurseCr] = useState(120);
  const [rtmEnabled, setRtmEnabled] = useState(true);
  const [countdown, setCountdown] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { code } = await startHosting(name.trim(), {
        starting_purse_lakhs: purseCr * 100,
        rtm_enabled: rtmEnabled,
        countdown_seconds: countdown,
      });
      router.push(`/host/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong creating the room.');
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <h1 className="font-display text-3xl">Host an Auction</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Your browser tab becomes the host — keep it open for the auction. Every rule below stays
          editable from the control panel after this.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm text-ink-muted">Your name (the auctioneer)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aakarsh"
              className="mt-1 w-full rounded-lg border border-line bg-panel-raised px-4 py-3 outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-sm text-ink-muted">Starting purse per team</label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {[90, 100, 120, 150].map((v) => (
                <button
                  key={v}
                  onClick={() => setPurseCr(v)}
                  className={`rounded-lg border py-2 font-display ${purseCr === v ? 'border-gold text-gold' : 'border-line text-ink-muted'}`}
                >
                  ₹{v}Cr
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm">Enable Right to Match (RTM)</label>
            <Toggle checked={rtmEnabled} onChange={setRtmEnabled} label="Enable Right to Match" />
          </div>

          <div>
            <label className="text-sm text-ink-muted">Countdown after each bid</label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {[5, 8, 10, 15].map((v) => (
                <button
                  key={v}
                  onClick={() => setCountdown(v)}
                  className={`rounded-lg border py-2 font-display ${countdown === v ? 'border-gold text-gold' : 'border-line text-ink-muted'}`}
                >
                  {v}s
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-crimson">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={busy || !name.trim()}
            className="w-full rounded-xl bg-gold text-void font-display text-lg py-4 disabled:opacity-50"
          >
            {busy ? 'Setting up…' : 'Create Room'}
          </button>
        </div>
      </div>
    </main>
  );
}
