export const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are as at be because been before being below between both but by can " +
    "could did do does doing down during each few for from further had has have having he her here hers herself him himself his " +
    "how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves " +
    "out over own same she should so some such than that the their theirs them themselves then there these they this those through " +
    "to too under until up very was we were what when where which while who whom why will with you your yours yourself yourselves " +
    "get got im it's i'm dont don't you're thats that's one like new make also us via amp rt"
  ).split(" "),
);

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return matches.map((tag) => tag.slice(1).toLowerCase());
}

export function normalizeTags(...lists: (string[] | undefined | null)[]): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      const tag = String(raw).replace(/^#/, "").trim().toLowerCase();
      if (tag && tag.length <= 60) out.add(tag);
    }
  }
  return [...out].slice(0, 25);
}

/** Lowercased, stopword-filtered content words — used for lightweight caption similarity. */
export function keywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .match(/[\p{L}\p{N}]{3,}/gu);
  return new Set((words ?? []).filter((w) => !STOPWORDS.has(w)));
}

export function normalizeTopic(topic: string): string {
  return topic.trim().replace(/\s+/g, " ").slice(0, 200);
}

export function topicToHashtag(topic: string): string {
  return topic.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
