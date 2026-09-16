"use client";

import { useEffect, useRef } from "react";

interface Blob {
  x: number; // 0..1 of width
  y: number; // 0..1 of height
  r: number; // radius as fraction of the larger side
  dx: number;
  dy: number;
}

interface Props {
  className?: string;
  /** Blob layout: "hero" = two large side globes, "cta" = centred band. */
  variant?: "hero" | "cta";
  cell?: number;
}

const RAMP = " .:-=+x%#@";

/** Animated character field (dot-matrix "globes") drawn on a canvas — the reference hero backdrop. */
export function AsciiField({ className = "", variant = "hero", cell = 11 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const blobs: Blob[] =
      variant === "hero"
        ? [
            { x: 0.12, y: 0.62, r: 0.34, dx: 0.00012, dy: 0.00005 },
            { x: 0.88, y: 0.5, r: 0.36, dx: -0.0001, dy: 0.00007 },
            { x: 0.5, y: 1.05, r: 0.3, dx: 0.00005, dy: -0.00003 },
          ]
        : [
            { x: 0.28, y: 0.5, r: 0.26, dx: 0.0001, dy: 0.00004 },
            { x: 0.74, y: 0.48, r: 0.27, dx: -0.00009, dy: -0.00005 },
          ];

    let width = 0;
    let height = 0;
    let frame = 0;
    let raf = 0;
    let visible = true;
    let last = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${Math.round(cell * 0.92)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    };

    // Cheap deterministic hash noise per cell + time step.
    const noise = (x: number, y: number, t: number) => {
      const s = Math.sin(x * 12.9898 + y * 78.233 + t * 0.7) * 43758.5453;
      return s - Math.floor(s);
    };

    const draw = (time: number) => {
      const dark = document.documentElement.classList.contains("dark");
      const base = dark ? "163,163,163" : "90,90,90";
      const size = Math.max(width, height);
      const t = Math.floor(time / 140);
      ctx.clearRect(0, 0, width, height);

      for (const blob of blobs) {
        blob.x += blob.dx * Math.sin(time / 4000);
        blob.y += blob.dy * Math.cos(time / 5000);
      }

      for (let gy = cell / 2; gy < height; gy += cell * 1.25) {
        for (let gx = cell / 2; gx < width; gx += cell) {
          let d = 0;
          for (const blob of blobs) {
            const dist = Math.hypot(gx - blob.x * width, (gy - blob.y * height) * 1.15) / (blob.r * size);
            // Ring-weighted falloff gives the sphere-like shading.
            if (dist < 1) d = Math.max(d, (1 - dist) * (0.55 + 0.45 * Math.sin(dist * 9 - time / 900)));
          }
          if (d < 0.06) continue;
          const n = noise(gx, gy, t);
          if (n > d * 1.6) continue;
          const level = Math.min(RAMP.length - 1, Math.floor(d * n * 1.8 * RAMP.length) + 1);
          const blue = n > 0.965 && d > 0.3;
          ctx.fillStyle = blue ? `rgba(47,128,255,${0.35 + d * 0.5})` : `rgba(${base},${0.08 + d * 0.42})`;
          ctx.fillText(RAMP[level], gx, gy);
        }
      }
    };

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || time - last < 90) return;
      last = time;
      frame++;
      draw(time);
    };

    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(canvas);
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      void frame;
    };
  }, [variant, cell]);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none block h-full w-full ${className}`} />;
}
