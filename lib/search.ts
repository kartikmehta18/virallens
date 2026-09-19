import { STOPWORDS, topicToHashtag } from "./text";

// Keyword search shared by the SQL repository (MariaDB REGEXP), the in-memory repository, the scrapers
// and the explore UI. A query is split into terms that are matched one by one, so "agentic ai data science"
// finds posts about agentic AI and data science instead of only posts containing that exact sentence.
//
//   agentic ai            words: "ai" matches the whole word only (not "said"); "agent" also finds agents
//   data science          also matches #datascience / data-science (a word glued to the previous one)
//   "exact phrase"        must appear as written
//   -crypto               excludes posts mentioning it
//   #tag                  hashtag / whole word
//
// Patterns use one regex dialect that behaves identically in MariaDB (PCRE2) and JavaScript ("iu" flags):
// Unicode-aware lookarounds instead of \b, so "café" doesn't match "cafés" and "ai" doesn't match "said".

export interface SearchTerm {
  /** How the term reads to a person: "ai", "\"data science\"", "#datascience". */
  label: string;
  /** Case-insensitive regex source. */
  pattern: string;
}

export interface ParsedSearch {
  /** The query as typed, whitespace collapsed. */
  text: string;
  /** Positive words for keyword-style platform searches (no quotes, -exclusions or #). */
  keywords: string;
  /** Content words in the order typed (stopwords dropped). */
  words: string[];
  terms: SearchTerm[];
  exclude: SearchTerm[];
  /** The typed words as one phrase — posts using that exact wording rank a notch higher. */
  phrase: string | null;
  /** Typed #hashtags, without the #. */
  hashtags: string[];
  /** A post must match at least this many terms: all of 1–2 terms, at least half of 3 or more. */
  minMatch: number;
}

const WORD_CHAR = "[\\p{L}\\p{N}_]";
const START = `(?<!${WORD_CHAR})`;
const END = `(?!${WORD_CHAR})`;
/** Between the words of a phrase: space, dash, underscore — or nothing (#datascience). */
const GAP = "[\\s_-]*";
const MAX_TERMS = 8;

const TOKEN = /(-?)"([^"]+)"|(-?)(#?)([\p{L}\p{N}][\p{L}\p{N}_+#.'’-]*)/gu;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A trailing plural "s" is ignored so "agents" also finds agent and agentic. */
const stem = (word: string) => (word.length >= 5 && word.endsWith("s") && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word);

/** Short words (ai, ml, ux) match whole words only; longer ones also match as a word start. */
function wordPattern(word: string, previous?: string) {
  const short = word.length <= 3;
  const tail = short ? `s?${END}` : "";
  const own = `${START}${escapeRegExp(word)}${tail}`;
  return previous ? `${own}|${START}${escapeRegExp(previous)}${GAP}${escapeRegExp(word)}${tail}` : own;
}

export function parseSearch(input: string): ParsedSearch {
  const text = input.trim().replace(/\s+/g, " ").slice(0, 200);
  const terms: SearchTerm[] = [];
  const exclude: SearchTerm[] = [];
  const hashtags: string[] = [];
  const keywords: string[] = [];
  const words: string[] = [];
  const sequence: string[] = [];
  const stopwordsOnly: string[] = [];
  let previous: string | undefined;

  for (const match of text.matchAll(TOKEN)) {
    const [, quoteNeg, quoted, wordNeg, hash, raw] = match;
    if (quoted !== undefined) {
      const parts = quoted.toLowerCase().match(/[\p{L}\p{N}_+#]+/gu) ?? [];
      if (!parts.length) continue;
      const term = { label: `"${parts.join(" ")}"`, pattern: `${START}${parts.map(escapeRegExp).join("[\\s_-]+")}${END}` };
      if (quoteNeg) exclude.push(term);
      else {
        terms.push(term);
        keywords.push(...parts);
      }
      previous = undefined;
      continue;
    }

    const word = raw.toLowerCase().replace(/[.'’-]+$/, "");
    if (!word) continue;
    if (wordNeg) {
      exclude.push({ label: `-${word}`, pattern: wordPattern(stem(word)) });
      continue;
    }
    keywords.push(word);
    if (hash) {
      hashtags.push(word);
      terms.push({ label: `#${word}`, pattern: `${START}${escapeRegExp(word)}${END}` });
      previous = undefined;
      continue;
    }
    sequence.push(word);
    if (STOPWORDS.has(word) || word.length < 2) {
      stopwordsOnly.push(word);
      previous = undefined;
      continue;
    }
    words.push(word);
    terms.push({ label: word, pattern: wordPattern(stem(word), previous) });
    previous = word;
  }

  // "how to" is all stopwords: search for them rather than for nothing.
  if (!terms.length && stopwordsOnly.length) {
    for (const word of stopwordsOnly) terms.push({ label: word, pattern: wordPattern(word) });
  }

  const unique = [...new Map(terms.map((t) => [t.pattern, t])).values()].slice(0, MAX_TERMS);
  const n = unique.length;
  return {
    text,
    keywords: keywords.join(" "),
    words,
    terms: unique,
    exclude: [...new Map(exclude.map((t) => [t.pattern, t])).values()],
    phrase: words.length >= 2 ? `${START}${sequence.map(escapeRegExp).join("[\\s_-]+")}` : null,
    hashtags,
    minMatch: n <= 2 ? n : Math.ceil(n / 2),
  };
}

/** Pattern for one standalone keyword (the similar-posts engine matches a post's key words this way). */
export const keywordPattern = (word: string) => wordPattern(stem(word.toLowerCase()));

/** The pattern as sent to MariaDB (case-insensitive inline flag). Always pass it as a bound parameter. */
export const sqlPattern = (pattern: string) => `(?i)${pattern}`;

const compiled = new WeakMap<ParsedSearch, { terms: RegExp[]; exclude: RegExp[]; phrase: RegExp | null }>();

function regexes(parsed: ParsedSearch) {
  let entry = compiled.get(parsed);
  if (!entry) {
    entry = {
      terms: parsed.terms.map((t) => new RegExp(t.pattern, "iu")),
      exclude: parsed.exclude.map((t) => new RegExp(t.pattern, "iu")),
      phrase: parsed.phrase ? new RegExp(parsed.phrase, "iu") : null,
    };
    compiled.set(parsed, entry);
  }
  return entry;
}

export interface SearchScore {
  /** Terms found. */
  matched: number;
  /** matched, +1 when the exact typed wording appears — the ranking tier. */
  relevance: number;
  excluded: boolean;
  /** Passes the query: not excluded and at least minMatch terms. */
  ok: boolean;
}

/** JS twin of the SQL scoring (lib/repo/prisma.ts) — keep the two in sync. */
export function scoreText(text: string, parsed: ParsedSearch): SearchScore {
  const re = regexes(parsed);
  const matched = re.terms.filter((r) => r.test(text)).length;
  const excluded = re.exclude.some((r) => r.test(text));
  const relevance = matched + (re.phrase?.test(text) ? 1 : 0);
  return { matched, relevance, excluded, ok: !excluded && matched >= parsed.minMatch };
}

/** The text a post is searched in — the same fields, in the same shape, as the SQL CONCAT_WS haystack. */
export function postHaystack(post: { topic: string; caption: string; authorName: string; authorHandle: string; tags: string[] }) {
  return [post.topic, post.caption, post.authorName, post.authorHandle, JSON.stringify(post.tags)].join(" ");
}

/**
 * How to search Instagram: its hashtag actor merges several words into one tag (#agenticaidatascience),
 * so multi-word queries use the actor's keyword mode; single words and typed #tags stay hashtag searches.
 */
export function instagramSearch(parsed: ParsedSearch): { keywordSearch: boolean; values: string[] } {
  if (parsed.hashtags.length) return { keywordSearch: false, values: parsed.hashtags.slice(0, 3) };
  const keywords = parsed.keywords || parsed.text;
  if (keywords.includes(" ")) return { keywordSearch: true, values: [keywords] };
  return { keywordSearch: false, values: [topicToHashtag(keywords) || keywords] };
}

/** Shorter searches to offer when a long query finds nothing: its first/last word pairs, then key words. */
export function suggestions(parsed: ParsedSearch, max = 4): string[] {
  const { words } = parsed;
  if (words.length < 2) return [];
  const out = new Set<string>();
  if (words.length >= 3) {
    out.add(words.slice(0, 2).join(" "));
    out.add(words.slice(-2).join(" "));
  }
  for (const word of [...words].sort((a, b) => b.length - a.length)) if (word.length >= 4) out.add(word);
  return [...out].filter((s) => s !== parsed.keywords).slice(0, max);
}
