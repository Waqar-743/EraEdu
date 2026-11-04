import { useEffect, useState } from 'react';
import { usePreferencesStore } from '../../store/preferencesStore';

export default function MotionControl({ compact = false }: { compact?: boolean }) {
  const { motionPaused, setMotionPaused } = usePreferencesStore();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  const stopped = motionPaused || reducedMotion;
  const label = reducedMotion ? 'Reduced motion on' : stopped ? 'Play animations' : 'Pause animations';
  return <button
    type="button"
    className={`home-motion-control ${compact ? 'home-motion-control--compact' : ''}`}
    aria-label={label}
    aria-pressed={stopped}
    disabled={reducedMotion}
    onClick={() => setMotionPaused(!motionPaused)}
    title={reducedMotion ? 'Your device has requested reduced motion.' : 'Control illustrations across EraEdu.'}
  >
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {stopped
        ? <path d="m5 3 7 5-7 5V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        : <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
    {!compact && label}
  </button>;
}
