import type { Post } from "../types";

const CTA = /\b(follow|save|share|repost|comment|drop|tag|subscribe|link in bio|what do you think|thoughts\??|agree\??|👇)/i;
const NUMBERED = /(^|\n)\s*(\d+[.)]|[-•→✅])\s+/;
const EMOTION =
  /\b(unpopular|nobody|secret|mistake|wild|shocking|never|stop|truth|dark side|finally|changed everything|regret)\b|🤯|🔥|😱/i;

/** Rule-based "why it worked" analysis used when no LLM key is configured. */
export function heuristicBreakdown(post: Post): string[] {
  const bullets: string[] = [];
  const firstLine =
    post.caption
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? "";
  const engagement = post.likeCount + post.commentCount + post.shareCount;

  if (firstLine) {
    const style = firstLine.endsWith("?")
      ? "opens with a question that invites an instant answer"
      : /\d/.test(firstLine)
        ? "leads with a concrete number, which signals specific, skimmable value"
        : EMOTION.test(firstLine)
          ? "uses a pattern-interrupt hook with curiosity or contrarian language"
          : "puts a clear promise in the very first line";
    bullets.push(`Hook: "${firstLine.slice(0, 90)}${firstLine.length > 90 ? "…" : ""}" ${style}, stopping the scroll before the fold.`);
  }

  const formatNotes: Record<Post["mediaType"], string> = {
    video: "Video format earns longer watch time, which platforms reward with wider distribution.",
    carousel: "Carousel format drives swipes and dwell time, and people save multi-slide posts to revisit later.",
    image: "A single strong visual makes the post instantly recognizable in a fast-moving feed.",
    text: "Text-only format feels personal and native, which tends to spark conversation rather than passive likes.",
  };
  bullets.push(
    NUMBERED.test(post.caption)
      ? `${formatNotes[post.mediaType]} The list-style structure makes it easy to skim and share.`
      : formatNotes[post.mediaType],
  );

  if (CTA.test(post.caption)) {
    bullets.push(
      "Explicit call-to-action gives readers a specific next step (comment, save or share), boosting the engagement signals algorithms rank on.",
    );
  }

  if (engagement > 0) {
    const commentRatio = post.commentCount / Math.max(post.likeCount, 1);
    const shareRatio = post.shareCount / Math.max(post.likeCount, 1);
    if (shareRatio > 0.08)
      bullets.push(
        `High share ratio (${Math.round(shareRatio * 100)} shares per 100 likes) shows the content is identity-affirming — people repost it to say something about themselves.`,
      );
    else if (commentRatio > 0.05)
      bullets.push(
        `Strong comment ratio (${Math.round(commentRatio * 100)} per 100 likes) suggests it touched a debate or shared experience worth responding to.`,
      );
    else bullets.push("Engagement is like-driven, typical of broadly relatable, easy-to-agree-with content.");
  }

  if (EMOTION.test(post.caption)) {
    bullets.push("Emotional angle: curiosity, surprise or contrarian framing creates tension the reader wants resolved.");
  } else if (post.tags.length) {
    bullets.push(
      `Topical hashtags (${post.tags
        .slice(0, 3)
        .map((t) => `#${t}`)
        .join(", ")}) place it in active niche conversations for discovery.`,
    );
  }

  return bullets.slice(0, 5);
}
