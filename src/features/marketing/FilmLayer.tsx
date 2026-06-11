'use client';

/* ============================================================
   Atmosphere film layer — a muted, looping, hard-graded clip
   behind a scene. Clips are optional: until a licensed file
   exists at the given src, onError hides the layer and the
   code-rendered night field carries the scene on its own.
   Drop clips in public/marketing/film/ (see README there).
   Hidden on small screens and under prefers-reduced-motion via
   .film-layer CSS.
   ============================================================ */
import { useState } from 'react';

export function FilmLayer({ src, opacity = 0.45 }: { src: string; opacity?: number }) {
  const [available, setAvailable] = useState(true);
  if (!available) return null;
  return (
    <div aria-hidden className="film-layer" style={{ opacity }}>
      <video src={src} autoPlay muted loop playsInline preload="metadata" onError={() => setAvailable(false)} />
      <span className="film-grade" />
    </div>
  );
}
