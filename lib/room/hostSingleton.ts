import { HostSession } from './hostSession';

let current: HostSession | null = null;
let currentCode: string | null = null;

export function setHostSession(code: string, session: HostSession) {
  if (current && currentCode !== code) current.destroy();
  current = session;
  currentCode = code;
}

export function getHostSession(code: string): HostSession | null {
  return currentCode === code ? current : null;
}

export function clearHostSession() {
  current?.destroy();
  current = null;
  currentCode = null;
}
