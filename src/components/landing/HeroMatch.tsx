"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Waveform from "./Waveform";

const REASONS = [
  "Topic overlap",
  "Long-form",
  "Toronto area",
  "In-person",
  "Relevant expertise",
];

function Check({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * The hero match sequence: two profile cards connected by a waveform,
 * reasons ticking in one by one, then the potential conversation.
 * Plays once when scrolled into view, like the product thinking aloud.
 */
export default function HeroMatch() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const step = () => `hero-step${on ? " on" : ""}`;

  return (
    <div
      ref={ref}
      className="mx-auto mt-12 max-w-3xl"
      aria-label="Illustrative match example"
    >
      {/* Cards + waveform connector */}
      <div
        className={step()}
        style={{ transitionDelay: "150ms" }}
      >
        <div className="flex items-center gap-2 sm:gap-5">
          <div className="flex w-24 shrink-0 flex-col items-center sm:w-32">
            <Image
              src="/examples/besquare-cover.jpg"
              alt="BeSquare podcast artwork"
              width={160}
              height={160}
              className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/20 sm:h-20 sm:w-20"
            />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Host
            </p>
            <p className="text-xs font-semibold text-white/85 sm:text-sm">
              BeSquare
            </p>
          </div>

          <Waveform
            bars={14}
            animated
            className="h-6 min-w-0 flex-1 text-brand/70"
          />

          <div className="shrink-0">
            <span
              className={`inline-block rounded-full border border-brand/50 bg-brand/15 px-3 py-1 text-sm font-extrabold text-brand sm:px-4 sm:text-base ${
                on ? "pct-pop" : "opacity-0"
              }`}
            >
              92%
            </span>
          </div>

          <Waveform
            bars={14}
            animated
            className="h-6 min-w-0 flex-1 text-brand/70"
          />

          <div className="flex w-24 shrink-0 flex-col items-center sm:w-32">
            <Image
              src="/examples/jane-smith.jpg"
              alt="Dr. Jane Smith"
              width={160}
              height={160}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-white/20 sm:h-20 sm:w-20"
            />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Guest
            </p>
            <p className="text-xs font-semibold text-white/85 sm:text-sm">
              Dr. Jane Smith
            </p>
          </div>
        </div>
      </div>

      {/* Reasons tick in one by one */}
      <ul
        className="mt-7 flex flex-wrap items-center justify-center gap-2"
        aria-label="Why this is a strong match"
      >
        {REASONS.map((r, i) => (
          <li
            key={r}
            className={step()}
            style={{ transitionDelay: `${650 + i * 200}ms` }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 sm:text-sm">
              <Check className="h-3.5 w-3.5 text-brand" />
              {r}
            </span>
          </li>
        ))}
      </ul>

      {/* Potential conversation */}
      <div className={step()} style={{ transitionDelay: "1950ms" }}>
        <p className="mt-9 text-[11px] font-bold uppercase tracking-[0.25em] text-white/40">
          Potential conversation
        </p>
        <p className="mx-auto mt-3 max-w-xl text-xl font-bold leading-snug text-white sm:text-2xl">
          “Will AI replace knowledge workers, or make them dramatically more
          powerful?”
        </p>
        <p className="mt-3 text-xs text-white/30">Illustrative example</p>
      </div>
    </div>
  );
}
