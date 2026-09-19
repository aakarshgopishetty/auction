'use client';

import { useEffect, useState } from 'react';
import { setSoundEnabled } from '@/lib/sound';

const KEY = 'auction-night:sound-enabled';

export function SoundToggle({ defaultEnabled = true }: { defaultEnabled?: boolean }) {
  const [on, setOn] = useState(defaultEnabled);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    const initial = stored != null ? stored === '1' : defaultEnabled;
    setOn(initial);
    setSoundEnabled(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, next ? '1' : '0');
  }

  return (
    <button
      onClick={toggle}
      className="rounded-lg border border-line px-3 py-2 text-sm hover:border-gold transition-colors"
      aria-label={on ? 'Mute sound' : 'Unmute sound'}
      title={on ? 'Mute sound' : 'Unmute sound'}
    >
      {on ? '🔊' : '🔇'}
    </button>
  );
}
