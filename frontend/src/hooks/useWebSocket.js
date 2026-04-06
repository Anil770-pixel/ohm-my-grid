import { useEffect, useRef } from 'react';

const API_BASE = '';
export const MAX_HISTORY = 60;

/**
 * useLiveData — polls /api/status every second.
 * Calls onUpdate(data) with each new payload.
 * No WebSocket complexity — just reliable fetch polling.
 */
export function useLiveData(onUpdate, intervalMs = 1000) {
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && data.solar_kw !== undefined) {
          onUpdate({ ...data, type: 'live_update' });
        }
      } catch {
        // backend not ready yet, silently retry
      }
    };

    // Poll immediately, then every intervalMs
    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * appendToHistory — add a value to a capped rolling array
 */
export function appendToHistory(arr, value, max = MAX_HISTORY) {
  const next = [...arr, value];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * makeTimestampLabels — generate the last N time labels (HH:MM:SS)
 */
export function makeTimestampLabels(count = MAX_HISTORY) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(now - (count - 1 - i) * 1000);
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
  });
}
