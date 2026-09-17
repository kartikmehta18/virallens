"use client";

import { useEffect, useRef } from "react";

// 24×24 filled silhouettes rendered as flickering blue characters (feature-card artwork).
const SHAPES = {
  flame:
    "M12 1.5c.9 3.2 3.4 5.3 5.2 7.6 1.6 2 2.8 4.1 2.8 6.6A8 8 0 0 1 12 23.5a8 8 0 0 1-8-7.8c0-2.2.9-4.2 2.4-5.8.3 1.9 1.3 3.3 3 3.9-.8-4.2.2-8.6 2.6-12.3Z",
  sparkle: "M12 1 14.7 9.3 23 12l-8.3 2.7L12 23l-2.7-8.3L1 12l8.3-2.7ZM19.5 1l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z",
  bell: "M12 1.5a1.6 1.6 0 0 1 1.6 1.6v.6A7 7 0 0 1 19 10.5v4.6l2.2 3.2c.4.6 0 1.4-.7 1.4H3.5c-.7 0-1.1-.8-.7-1.4L5 15.1v-4.6a7 7 0 0 1 5.4-6.8v-.6A1.6 1.6 0 0 1 12 1.5ZM9 21.5h6a3 3 0 0 1-6 0Z",
  eye: "M12 4.5c5.5 0 9.6 4.3 11 7.5-1.4 3.2-5.5 7.5-11 7.5S2.4 15.2 1 12c1.4-3.2 5.5-7.5 11-7.5Zm0 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  bookmark: "M5 1.5h14a1 1 0 0 1 1 1v20l-8-5.2-8 5.2v-20a1 1 0 0 1 1-1Z",
} as const;

export type AsciiShape = keyof typeof SHAPES;

const CHARS = "@#%$&8BWMKX0*";

export function AsciiIcon({ shape, size = 150, className = "" }: { shape: AsciiShape; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const cols = 26;
    const cell = size / cols;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rasterise the silhouette once into a coverage mask.
    const mask = document.createElement("canvas");
    mask.width = cols;
    mask.height = cols;
    const mctx = mask.getContext("2d")!;
    mctx.scale(cols / 24, cols / 24);
    mctx.fill(new Path2D(SHAPES[shape]), "evenodd");
    const alpha = mctx.getImageData(0, 0, cols, cols).data;

    ctx.font = `600 ${Math.round(cell * 1.05)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    const draw = (time: number) => {
      ctx.clearRect(0, 0, size, size);
      const t = Math.floor(time / 180);
      for (let y = 0; y < cols; y++) {
        for (let x = 0; x < cols; x++) {
          const a = alpha[(y * cols + x) * 4 + 3] / 255;
          if (a < 0.35) continue;
          const h = Math.sin((x + 1) * 91.7 + (y + 1) * 37.3 + t * 1.3) * 10000;
          const r = h - Math.floor(h);
          if (r < 0.12) continue; // flicker gaps
          ctx.fillStyle = `rgba(47,128,255,${0.55 + r * 0.45})`;
          ctx.fillText(CHARS[Math.floor(r * CHARS.length)], x * cell + cell / 2, y * cell + cell / 2);
        }
      }
    };
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      if (time - last < 160) return;
      last = time;
      draw(time);
    };
    draw(0);
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shape, size]);

  return <canvas ref={ref} aria-hidden style={{ width: size, height: size }} className={className} />;
}
