"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The play header's star count (practice levels only — see app/play/page.tsx
 * `funOn`). Never shows misses or a total out of max, just the running count
 * for this sitting; pops briefly whenever it goes up, with an optional
 * "Bonus star!" flourish for lib/engine/rewards.ts's bonusStar.
 */
export function StarJar({ stars, bonus }: { stars: number; bonus?: boolean }) {
  const [pop, setPop] = useState(false);
  const prevRef = useRef(stars);

  useEffect(() => {
    if (stars <= prevRef.current) {
      prevRef.current = stars;
      return;
    }
    prevRef.current = stars;
    setPop(true);
    const t = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(t);
  }, [stars]);

  return (
    <div className="relative flex items-center gap-1" aria-label={`${stars} stars`}>
      <span className={`text-2xl transition-transform duration-300 ${pop ? "scale-125" : "scale-100"}`} aria-hidden>
        ⭐
      </span>
      <span className="font-bubble text-xl text-ink">{stars}</span>
      {bonus && (
        <span
          className="absolute -top-7 left-0 whitespace-nowrap rounded-full bg-amber-400 px-2 py-0.5 font-bubble text-sm text-ink shadow"
          aria-hidden
        >
          ✨ Bonus star!
        </span>
      )}
    </div>
  );
}

export default StarJar;
