"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms once the element scrolls into view. */
  delay?: number;
  as?: "div" | "li" | "span" | "section" | "article";
};

/**
 * Fades/slides content in the first time it scrolls into view.
 * Respects prefers-reduced-motion via the global CSS rule.
 */
export default function Reveal({
  children,
  className = "",
  delay = 0,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref: (node: unknown) => {
        ref.current = node as HTMLElement | null;
      },
      className: `reveal${visible ? " is-visible" : ""}${
        className ? ` ${className}` : ""
      }`,
      style: { transitionDelay: `${delay}ms` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    children
  );
}
