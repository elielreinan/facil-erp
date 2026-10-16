export type ClientErrorEntry = {
  timestamp: string;
  level: 'ERROR' | 'WARN';
  message: string;
};

const storageKey = 'facilerp.clientErrors';
const maxEntries = 50;

export function readClientErrors(): ClientErrorEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = localStorage.getItem(storageKey);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ClientErrorEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const item = entry as Record<string, unknown>;
      return typeof item.timestamp === 'string' && (item.level === 'ERROR' || item.level === 'WARN') && typeof item.message === 'string';
    });
  } catch (error) {
    console.error('Falha ao ler diagnóstico local:', error);
    return [];
  }
}

export function recordClientError(level: ClientErrorEntry['level'], message: string) {
  if (typeof window === 'undefined') return;
  const entry: ClientErrorEntry = { timestamp: new Date().toISOString(), level, message: message.slice(0, 500) };
  try {
    localStorage.setItem(storageKey, JSON.stringify([...readClientErrors(), entry].slice(-maxEntries)));
    window.dispatchEvent(new Event('facilerp:diagnostics-changed'));
  } catch (error) {
    console.error('Falha ao registrar diagnóstico local:', error);
  }
}

export function clearClientErrors() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event('facilerp:diagnostics-changed'));
}
