const ITEMS = [
  "AI Agents × Future of Work",
  "Longevity × Medicine",
  "Entrepreneurship × Failure",
  "Climate × Great Lakes",
  "Psychology × Social Media",
  "Food × Culture",
  "Space × Economics",
  "Music × Memory",
];

/**
 * A thin, continuously moving ticker of conversations being discovered.
 * Pure CSS animation; pauses on hover. Illustrative until real activity.
 */
export default function Ticker() {
  return (
    <section
      aria-label="Conversations being discovered"
      className="border-y border-white/10 bg-navy-950/70 py-5"
    >
      <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-white/40">
        Conversations being discovered{" "}
        <span className="font-medium normal-case tracking-normal text-white/25">
          · illustrative
        </span>
      </p>
      <div className="ticker-mask overflow-hidden">
        <div className="ticker-track">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="flex shrink-0 items-center"
            >
              {ITEMS.map((t) => (
                <span
                  key={`${copy}-${t}`}
                  className="flex items-center whitespace-nowrap text-sm font-medium text-white/55 sm:text-base"
                >
                  <span className="px-6">{t}</span>
                  <span aria-hidden="true" className="font-bold text-brand">
                    →
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
