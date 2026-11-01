import { useEffect } from 'react';

// Keep open dashboards current after changes from another browser/account.
// Callers provide a stable callback and handle their own error display.
export const useLiveRefresh = (
  refresh: () => void | Promise<unknown>,
  { intervalMs = 15000, enabled = true }: { intervalMs?: number; enabled?: boolean } = {},
) => {
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let pending = false;
    const run = async () => {
      if (disposed || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        await refresh();
      } catch (error) {
        console.error('Dashboard refresh failed:', error);
      } finally {
        pending = false;
      }
    };
    void run();
    const onVisible = () => { void run(); };
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, intervalMs);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs, enabled]);
};
