let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', startDelay = 0, gain = 0.15) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = audioCtx.currentTime + startDelay;
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // Audio can fail in all sorts of environment-specific ways — never let a beep break the auction.
  }
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}
export function isSoundEnabled() {
  return enabled;
}

export function playBid() {
  if (enabled) tone(880, 0.12, 'triangle');
}
export function playReveal() {
  if (!enabled) return;
  tone(440, 0.3, 'sine');
  tone(660, 0.3, 'sine', 0.08);
}
export function playSold() {
  if (!enabled) return;
  tone(523.25, 0.15, 'triangle');
  tone(659.25, 0.15, 'triangle', 0.12);
  tone(783.99, 0.35, 'triangle', 0.24);
}
export function playUnsold() {
  if (!enabled) return;
  tone(392, 0.25, 'sawtooth', 0, 0.1);
  tone(261.63, 0.4, 'sawtooth', 0.15, 0.1);
}
export function playCountdownTick() {
  if (enabled) tone(1200, 0.05, 'square', 0, 0.06);
}
