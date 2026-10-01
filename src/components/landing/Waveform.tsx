type WaveformProps = {
  /** Number of bars in the waveform. */
  bars?: number;
  /** Extra classes (controls height/width/color via text color). */
  className?: string;
  /** Gently animate the bars, like audio playing. */
  animated?: boolean;
};

/**
 * The GetOnShows brand motif: a waveform connecting host and guest.
 * Deterministic bar heights (no random/hydration issues).
 */
export default function Waveform({
  bars = 32,
  className = "",
  animated = false,
}: WaveformProps) {
  const heights = Array.from({ length: bars }, (_, i) => {
    const t = bars === 1 ? 0 : i / (bars - 1);
    const env = Math.abs(Math.sin(t * Math.PI * 2.2)) * 0.7 + 0.3;
    const detail = 0.75 + 0.25 * Math.sin(t * Math.PI * 9 + 1.3);
    return Math.round((5 + 15 * env * detail) * 10) / 10;
  });
  const width = bars * 5;

  return (
    <svg
      viewBox={`0 0 ${width} 22`}
      preserveAspectRatio="none"
      className={`${animated ? "wave-animated" : ""} ${className}`}
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 5 + 1.75}
          y={11 - h / 2}
          width={1.5}
          height={h}
          rx={0.75}
          className="fill-current"
          style={
            animated ? { animationDelay: `${(i % 7) * 0.22}s` } : undefined
          }
        />
      ))}
    </svg>
  );
}
