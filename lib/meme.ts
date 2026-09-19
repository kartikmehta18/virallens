import type { MediaType } from "./types";

// "How meme-like is this post?" — a 0–100 heuristic stored on every post (Post.memeScore) so the
// "Memes" sort can order by it and blend with the other sorts. It is deliberately explainable and
// cheap: no AI call, no network, just the caption, hashtags and media type.
//
// Nothing here is platform-specific: a LinkedIn "when the standup runs 45 minutes 💀" post is as much
// a meme as an Instagram one. Posts with no meme signal at all score 0, which is the common case.

/** Explicit meme vocabulary — if someone tags #memes, they mean it. */
const STRONG = new Set([
  "meme",
  "memes",
  "memesdaily",
  "memeoftheday",
  "memepage",
  "memer",
  "dankmeme",
  "dankmemes",
  "dank",
  "shitpost",
  "shitposting",
  "funnymemes",
  "memeaccount",
  "relatablememes",
  "brainrot",
]);

/** Humour words: a meme signal, but a weaker one (plenty of serious posts say "funny"). */
const FUNNY = new Set([
  "funny",
  "funnyvideos",
  "lol",
  "lmao",
  "lmfao",
  "rofl",
  "hilarious",
  "humor",
  "humour",
  "comedy",
  "joke",
  "jokes",
  "jokeoftheday",
  "satire",
  "parody",
  "relatable",
  "sarcasm",
  "banter",
  "goofy",
  "cursed",
  "trolling",
  "pun",
  "puns",
]);

/** Caption formats memes are written in ("POV:", "nobody: … me:", "when you …"). */
const FORMATS: RegExp[] = [
  /\bpov\s*[:\-]/i,
  /\bnobody\s*:/i,
  /\bno one\s*:/i,
  /\bme\s*:\s*\S/i,
  // Only as the caption's opener ("When you…", "Me when…") — "come back when you're stuck" mid-sentence,
  // or an essay paragraph starting "When we talk about…", is not a meme.
  /^\W*(me |that feeling )?when (you|your|ur|the|i|we|they|he|she|my|someone)\b/i,
  /\bthat moment when\b/i,
  /\bexpectation(s)? vs\.? reality\b/i,
  /\b(in )?(19|20)\d\d vs\.? .{0,40}\b(in )?(19|20)\d\d\b/i,
  /\bstarter pack\b/i,
  /\btell me .{1,60} without telling me\b/i,
  /\btfw\b/i,
  /\bcaught in 4k\b/i,
  /\bit'?s giving\b/i,
  /\bnot me \w+ing\b/i,
  /\bwho did this\b/i,
  /\bi'?m (dead|crying|screaming)\b/i,
];

/** Laughing / skull / clown faces — the emoji people react to memes with. */
const LAUGH_EMOJI = /[\u{1F602}\u{1F923}\u{1F480}\u{1F62D}\u{1F921}\u{1F928}\u{1F644}\u{1F972}]/gu;

/** Per-category ceilings, so a post can't win on hashtag spam alone. */
const CAPS = { tags: 55, words: 40, formats: 30, emoji: 15 } as const;

interface MemeInput {
  caption: string;
  tags: string[];
  mediaType: MediaType;
}

/**
 * 0 = no meme signal, 100 = unmistakably a meme. The media bonus only applies once the text already
 * looks meme-ish, otherwise "Memes" would degenerate into "images first".
 */
export function memeScore({ caption, tags, mediaType }: MemeInput): number {
  let tagPoints = 0;
  for (const raw of tags) {
    const tag = raw.replace(/^#/, "").toLowerCase();
    tagPoints += STRONG.has(tag) ? 30 : FUNNY.has(tag) ? 12 : 0;
  }

  // Distinct words only: repeating "lol" five times isn't five times the signal.
  let wordPoints = 0;
  for (const word of new Set(caption.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [])) {
    wordPoints += STRONG.has(word) ? 25 : FUNNY.has(word) ? 8 : 0;
  }

  const formatPoints = FORMATS.filter((format) => format.test(caption)).length * 12;
  const laughs = (caption.match(LAUGH_EMOJI) ?? []).length;

  let score =
    Math.min(tagPoints, CAPS.tags) +
    Math.min(wordPoints, CAPS.words) +
    Math.min(formatPoints, CAPS.formats) +
    (laughs ? Math.min(5 + laughs * 3, CAPS.emoji) : 0);

  // Visual bonus: memes are pictures far more often than essays — but only for posts that already
  // read like one, and short captions are the meme norm (the image carries the joke).
  if (score > 0) {
    if (mediaType === "image" || mediaType === "carousel") score += 12;
    else if (mediaType === "video") score += 8;
    if (caption.length <= 180) score += 5;
  }

  return Math.round(Math.min(score, 100) * 1000) / 1000;
}
