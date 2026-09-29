"use client";

import { useMutation } from "@tanstack/react-query";
import { Gauge, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { inputClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { PLATFORM_LABELS } from "@/lib/client/filters";
import { useSession } from "@/lib/client/session";
import { PLATFORMS, type Platform, type SimulationResult } from "@/lib/types";
import { SimulationReport } from "./simulation-report";

const CAPTION_LIMITS: Record<Platform, number> = { x: 280, linkedin: 3000, instagram: 2200 };
/** Uploads are downsized to this longest side (JPEG) before they're sent. */
const MAX_SIDE = 1280;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface Draft {
  platform: Platform;
  niche: string;
  caption: string;
  /** JPEG data URL */
  image: string | null;
}

async function prepareImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff"; // transparent PNGs flatten onto white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function SimulatorView() {
  const { session } = useSession();
  const [draft, setDraft] = useState<Draft>({ platform: "linkedin", niche: "", caption: "", image: null });
  const [imageError, setImageError] = useState<string | null>(null);
  const results = useRef<HTMLDivElement>(null);

  const simulate = useMutation({
    mutationFn: (d: Draft) =>
      api<SimulationResult>("/api/simulate", {
        method: "POST",
        json: { platform: d.platform, caption: d.caption, niche: d.niche.trim() || undefined, image: d.image ?? undefined },
      }),
    // Results sit below the form on phones, and "Score this version" is clicked at the bottom of a report:
    // bring the results' top into view when it's off screen.
    onMutate: () => {
      const top = results.current?.getBoundingClientRect().top ?? 0;
      if (top < 0 || top > window.innerHeight * 0.6) results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const run = (d: Draft) => d.caption.trim().length >= 3 && simulate.mutate(d);

  const addImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setImageError("That file isn't an image.");
    if (file.size > MAX_FILE_BYTES) return setImageError("That image is over 20 MB.");
    try {
      update({ image: await prepareImage(file) });
      setImageError(null);
    } catch {
      setImageError("Couldn't read that image — try a JPG or PNG.");
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      addImage(file);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(draft);
  };

  // "Score this version" on a rewrite: load it into the form and score it.
  const rescore = (caption: string) => {
    const next = { ...draft, caption };
    setDraft(next);
    run(next);
  };

  const limit = CAPTION_LIMITS[draft.platform];
  const length = draft.caption.length;

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:px-10">
      <h1 className="display text-[36px] sm:text-[44px]">
        Virality <b>simulator</b>
      </h1>
      <p className="text-muted mt-3 max-w-2xl text-[15px] leading-relaxed">
        Score a post before you publish it. Your draft is benchmarked against real, scored posts from the same niche and platform — with
        specific fixes, and two rewritten versions when it isn&apos;t there yet.
      </p>

      <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <form
          onSubmit={onSubmit}
          onPaste={onPaste}
          className="border-border bg-surface relative space-y-5 border p-4 sm:p-6 lg:sticky lg:top-24"
        >
          <Crosshairs />
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">Platform</legend>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => update({ platform: p })}
                  aria-pressed={draft.platform === p}
                  className={`flex h-9 items-center justify-center gap-2 rounded-md border px-2 text-[13px] transition ${draft.platform === p ? "border-foreground/40 bg-surface-2 text-foreground" : "border-border text-muted hover:text-foreground"}`}
                >
                  <PlatformIcon platform={p} className="size-3.5" /> {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-[13px] font-medium">
              Niche or topic <span className="text-muted font-normal">(optional)</span>
            </span>
            <input
              value={draft.niche}
              onChange={(e) => update({ niche: e.target.value })}
              placeholder="e.g. AI tools, personal finance, fitness"
              maxLength={80}
              className={inputClass}
            />
          </label>

          <div>
            <span className="mb-2 block text-[13px] font-medium">
              Image <span className="text-muted font-normal">(optional)</span>
            </span>
            <ImagePicker value={draft.image} onFile={addImage} onClear={() => update({ image: null })} />
            {imageError && <p className="mt-2 text-sm text-red-500">{imageError}</p>}
          </div>

          <label className="block">
            <span className="mb-2 flex items-baseline justify-between text-[13px] font-medium">
              Caption
              <span className={`text-[11.5px] font-normal tabular-nums ${length > limit ? "text-red-500" : "text-muted"}`}>
                {length.toLocaleString()} / {limit.toLocaleString()}
              </span>
            </span>
            <textarea
              value={draft.caption}
              onChange={(e) => update({ caption: e.target.value })}
              placeholder="Paste the post you're about to publish — hook first."
              rows={9}
              maxLength={5000}
              className={`${inputClass} h-auto min-h-[200px] resize-y py-3 leading-relaxed`}
            />
          </label>

          <button disabled={simulate.isPending || draft.caption.trim().length < 3} className="btn-primary w-full">
            {simulate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
            {simulate.isPending ? "Scoring…" : "Score my post"}
          </button>
          {simulate.isError && <p className="text-sm text-red-500">{simulate.error.message}</p>}
          {session?.aiProvider === "heuristic" && (
            <p className="text-muted text-xs leading-relaxed">
              No AI provider is configured, so scoring uses the built-in structural analysis: no image feedback, and template-based
              rewrites.
            </p>
          )}
        </form>

        <div ref={results} className="min-w-0 scroll-mt-24">
          {simulate.isPending ? (
            <Pending />
          ) : simulate.data ? (
            <SimulationReport result={simulate.data} onRescore={rescore} />
          ) : (
            <HowItWorks />
          )}
        </div>
      </div>
    </div>
  );
}

function ImagePicker({ value, onFile, onClear }: { value: string | null; onFile: (file: File | undefined) => void; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (value) {
    return (
      <div className="border-border bg-background relative overflow-hidden rounded-md border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Your post image" className="mx-auto max-h-64 w-auto object-contain" />
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove image"
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black/85"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition ${dragging ? "border-accent bg-accent/5" : "border-border hover:border-foreground/30 hover:bg-surface-2"}`}
      >
        <ImagePlus className="text-muted size-5" />
        <span className="text-[13px] font-medium">Add the image you&apos;ll post</span>
        <span className="text-muted text-[11.5px]">Drop, paste or click · JPG, PNG, WebP</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

const STEPS = [
  "Finding real posts in your niche…",
  "Scoring them on the platform scale…",
  "Comparing your draft with the top performers…",
  "Writing feedback and rewrites…",
];

function Pending() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="border-border bg-surface relative border p-6">
        <Crosshairs />
        <p className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="text-accent size-4 animate-spin" /> {STEPS[step]}
        </p>
        <div className="skeleton mt-5 h-16 w-32 rounded-md" />
        <div className="skeleton mt-5 h-2 w-full rounded-full" />
      </div>
      <div className="skeleton h-28 rounded-md" />
      <div className="skeleton h-48 rounded-md" />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Find your niche", body: "Real posts on the same subject and platform, from the posts ViralLens has already scored." },
    { title: "Compare with the best", body: "Your hook, length, layout, CTA, format and image against the top and bottom performers." },
    {
      title: "Score, fix, rewrite",
      body: "A 0–100 prediction on the same scale, diff-style fixes — and two rewrites if it scores below 70.",
    },
  ];
  return (
    <div className="border-border relative flex flex-col border px-6 py-10 sm:px-10 sm:py-14">
      <Crosshairs />
      <Gauge className="text-muted size-7" />
      <p className="mt-4 text-lg font-medium">How the simulator works</p>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="border-border text-muted grid size-7 place-items-center rounded-md border text-[12px] font-medium tabular-nums">
              {i + 1}
            </span>
            <p className="mt-3 text-sm font-medium">{s.title}</p>
            <p className="text-muted mt-1 text-[13px] leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-muted mt-8 text-xs leading-relaxed">
        The score is a post&apos;s engagement percentile among stored posts on its platform: 50 is a typical post, 90 beats nine in ten.
      </p>
    </div>
  );
}
