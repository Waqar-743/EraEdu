type MotionControlProps = {
  paused: boolean;
  reducedMotion: boolean;
  onToggle: () => void;
};

export default function MotionControl({ paused, reducedMotion, onToggle }: MotionControlProps) {
  const label = reducedMotion ? 'Reduced motion on' : paused ? 'Play animations' : 'Pause animations';
  return <button
    type="button"
    className="home-motion-control"
    aria-label={label}
    aria-pressed={paused}
    disabled={reducedMotion}
    onClick={onToggle}
    title={reducedMotion ? 'Your device has requested reduced motion.' : 'Control animations on this homepage.'}
  >
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {paused
        ? <path d="m5 3 7 5-7 5V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        : <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
    {label}
  </button>;
}
