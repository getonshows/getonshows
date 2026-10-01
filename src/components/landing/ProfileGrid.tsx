"use client";

import { useState } from "react";
import Image from "next/image";

export type ExampleProfile = {
  id: string;
  kind: string;
  name: string;
  role: string;
  location: string;
  image: string;
  tags: string[];
  hook: string;
  matchId: string;
  matchName: string;
  matchImage: string;
};

/**
 * Visual profile cards. The conversation is the unit, not the metadata.
 * Hovering a profile reveals its potential match and lights up the
 * matching card with the brand accent.
 */
export default function ProfileGrid({
  profiles,
}: {
  profiles: ExampleProfile[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hovered = profiles.find((p) => p.id === hover) ?? null;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {profiles.map((p) => {
        const isHovered = hover === p.id;
        const isMatchTarget =
          hovered !== null && hovered.id !== p.id && hovered.matchId === p.id;
        return (
          <article
            key={p.id}
            tabIndex={0}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p.id)}
            onBlur={() => setHover(null)}
            className={`group rounded-2xl border bg-white/[0.03] p-5 transition-all duration-300 ${
              isMatchTarget
                ? "border-brand/60 shadow-[0_0_44px_-12px_rgba(255,90,54,0.55)]"
                : "border-white/10 hover:border-white/25"
            }`}
          >
            <Image
              src={p.image}
              alt={p.name}
              width={224}
              height={224}
              className="h-24 w-24 rounded-2xl object-cover ring-1 ring-white/15"
            />
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
              {p.kind}
            </p>
            <h3 className="mt-1 text-lg font-bold text-white">{p.name}</h3>
            <p className="mt-0.5 text-sm text-white/50">
              {p.role} · {p.location}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70 ring-1 ring-white/10"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Good for conversations about
            </p>
            <p className="mt-1.5 font-semibold leading-snug text-white/90">
              “{p.hook}”
            </p>
            <div
              className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ${
                isHovered ? "mt-4 max-h-16 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <Image
                src={p.matchImage}
                alt=""
                width={64}
                height={64}
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-brand/60"
              />
              <p className="whitespace-nowrap text-xs">
                <span className="font-bold text-brand">Strong match</span>
                <span className="text-white/60"> · {p.matchName}</span>
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
