'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toggle } from '@/components/Toggle';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [spectator, setSpectator] = useState(false);

  function handleJoin() {
    if (!code.trim() || !name.trim()) return;
    const normalized = code.trim().toUpperCase().replace(/^AUCTION-?/, '').replace(/[^A-Z0-9]/g, '');
    const params = new URLSearchParams({ name: name.trim(), spectator: spectator ? '1' : '0' });
    router.push(`/room/${normalized}?${params.toString()}`);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <h1 className="font-display text-3xl">Join with a Code</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Ask the host for the room code, e.g. 7X92 — and make sure their screen is still open.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm text-ink-muted">Room code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="7X92"
              className="mt-1 w-full rounded-lg border border-line bg-panel-raised px-4 py-3 outline-none focus:border-gold uppercase font-display tracking-[0.3em] text-center text-2xl"
              maxLength={12}
            />
          </div>
          <div>
            <label className="text-sm text-ink-muted">Your display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul"
              className="mt-1 w-full rounded-lg border border-line bg-panel-raised px-4 py-3 outline-none focus:border-gold"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Join as a spectator (no bidding)</label>
            <Toggle checked={spectator} onChange={setSpectator} label="Join as a spectator" />
          </div>

          <button
            onClick={handleJoin}
            disabled={!code.trim() || !name.trim()}
            className="w-full rounded-xl bg-gold text-void font-display text-lg py-4 disabled:opacity-50"
          >
            Join Room
          </button>
        </div>
      </div>
    </main>
  );
}
