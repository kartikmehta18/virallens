import type { MediaType, Platform, PostInput } from "../types";
import { normalizeTags, topicToHashtag } from "../text";

// Deterministic demo data so the app is fully usable without an Apify token.

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOOKS = [
  "I spent 90 days testing {topic}. Here's what nobody tells you:",
  "Stop scrolling. This {topic} trick changed everything for me.",
  "Unpopular opinion: most people are doing {topic} completely wrong.",
  "{topic} in 2026 is not what you think. A thread 🧵",
  "The 5-minute {topic} routine that 10x'd my results.",
  "We analyzed 1,000 posts about {topic}. The pattern is wild.",
  "If you're new to {topic}, save this post. You'll thank me later.",
  "Nobody talks about the dark side of {topic}.",
  "My biggest {topic} mistake cost me 6 months. Don't repeat it.",
  "3 {topic} tools I use every single day (all free):",
  "Here's the exact {topic} framework we used to grow from 0 → 100k.",
  "POV: you finally understand {topic} 🤯",
];

const BODIES = [
  "1. Start before you feel ready.\n2. Obsess over the first 3 seconds.\n3. Consistency beats intensity every time.",
  "The secret isn't talent. It's building a system you can repeat on your worst day.",
  "Most advice is recycled. What actually works is boring, specific, and measurable.",
  "We tried everything. The only thing that moved the needle was talking to real users every week.",
  "Here's the breakdown with real numbers, screenshots and the template we use.",
  "Bookmark this and come back when you're stuck. It works.",
];

const CTAS = [
  "Follow for more.",
  "What would you add? 👇",
  "Repost if this helped someone on your team ♻️",
  "Save this for later.",
  "Drop a 🔥 if you want part 2.",
  "",
];

const FIRST = ["Maya", "Arjun", "Sofia", "Liam", "Priya", "Noah", "Zara", "Ethan", "Aisha", "Lucas", "Elena", "Kenji", "Nina", "Omar"];
const LAST = ["Chen", "Patel", "Garcia", "Kim", "Rossi", "Nguyen", "Singh", "Müller", "Okafor", "Silva", "Tanaka", "Ahmed"];

const DEMO_VIDEOS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
];

const PLATFORM_MEDIA: Record<Platform, MediaType[]> = {
  x: ["text", "text", "image", "image", "video"],
  linkedin: ["text", "image", "image", "carousel", "video"],
  instagram: ["image", "image", "carousel", "carousel", "video"],
};

const PLATFORM_SCALE: Record<Platform, number> = { x: 1.2, linkedin: 0.6, instagram: 1.6 };

function demoPostUrl(platform: Platform, topic: string, hashtag: string, index: number): string {
  const ref = `ref=virallens-${hashtag}-${index}`;
  const q = encodeURIComponent(topic);
  if (platform === "x") return `https://x.com/search?q=${q}&f=top&${ref}`;
  if (platform === "linkedin") return `https://www.linkedin.com/search/results/content/?keywords=${q}&${ref}`;
  return `https://www.instagram.com/explore/tags/${hashtag}/?${ref}`;
}

/** Demo creator posts link to the creator's real profile page (unique per post via `ref`). */
function demoCreatorPostUrl(platform: Platform, handle: string, index: number): string {
  const h = encodeURIComponent(handle.toLowerCase());
  const ref = `ref=virallens-creator-${index}`;
  if (platform === "x") return `https://x.com/${h}?${ref}`;
  if (platform === "linkedin") return `https://www.linkedin.com/in/${h}/recent-activity/all/?${ref}`;
  return `https://www.instagram.com/${h}/?${ref}`;
}

export const DEMO_TOPICS = ["AI tools", "productivity", "startups", "fitness", "personal branding", "design"];

export interface DemoAuthor {
  handle: string;
  name: string;
  avatarUrl: string | null;
}

/** A plausible niche for a demo creator, stable per handle. */
export const demoCreatorTopic = (handle: string) => DEMO_TOPICS[hashString(handle.toLowerCase()) % DEMO_TOPICS.length];

/** Deterministic demo posts for a topic, or — when `author` is given — a creator's own recent posts. */
export function generateDemoPosts(topic: string, platform: Platform, count = 16, author?: DemoAuthor): PostInput[] {
  const random = rng(hashString(`${platform}:${topic.toLowerCase()}${author ? `:@${author.handle.toLowerCase()}` : ""}`));
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const hashtag = topicToHashtag(topic) || "trending";
  const posts: PostInput[] = [];

  for (let i = 0; i < count; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const handle = author?.handle ?? `${first}${last}`.toLowerCase().replace(/[^a-z]/g, "") + Math.floor(random() * 99);
    const mediaType = pick(PLATFORM_MEDIA[platform]);
    const extraTags = [
      hashtag,
      pick(["growth", "tips", "creator", "marketing", "mindset", "career", "tech", "learning"]),
      pick(["viral", "strategy", "howto", "motivation"]),
    ];
    const caption = [pick(HOOKS).replaceAll("{topic}", topic), pick(BODIES), pick(CTAS), extraTags.map((t) => `#${t}`).join(" ")]
      .filter(Boolean)
      .join("\n\n");

    // Log-normal-ish engagement so a few posts clearly "go viral".
    const virality = Math.exp(random() * 4.5) * PLATFORM_SCALE[platform];
    const likes = Math.round(virality * (80 + random() * 400));
    const hoursAgo = random() < 0.35 ? random() * 48 : random() * 24 * 30;
    const seed = `${platform}-${hashtag}-${author ? `${author.handle}-` : ""}${i}`;
    const tall = random() > 0.5;
    const size = tall ? "800/1000" : "900/900";

    const mediaUrls =
      mediaType === "image"
        ? [`https://picsum.photos/seed/${seed}/${size}`]
        : mediaType === "carousel"
          ? [0, 1, 2, 3].slice(0, 2 + Math.floor(random() * 3)).map((n) => `https://picsum.photos/seed/${seed}-${n}/900/1000`)
          : mediaType === "video"
            ? [pick(DEMO_VIDEOS)]
            : [];

    posts.push({
      platform,
      authorName: author?.name ?? `${first} ${last}`,
      authorHandle: handle,
      authorAvatarUrl: author ? (author.avatarUrl ?? `https://i.pravatar.cc/150?u=${handle}`) : `https://i.pravatar.cc/150?u=${handle}`,
      caption,
      mediaType,
      mediaUrls,
      thumbnailUrl: mediaType === "text" ? null : `https://picsum.photos/seed/${seed}/${size}`,
      // Demo posts link to the real platform's search for the topic (unique per post via `ref`).
      postUrl: author ? demoCreatorPostUrl(platform, author.handle, i) : demoPostUrl(platform, topic, hashtag, i),
      likeCount: likes,
      commentCount: Math.round(likes * (0.02 + random() * 0.08)),
      shareCount: Math.round(likes * (0.01 + random() * (platform === "x" ? 0.2 : 0.05))),
      viewCount: platform === "linkedin" && mediaType !== "video" ? null : Math.round(likes * (8 + random() * 30)),
      topic,
      tags: normalizeTags(extraTags),
      publishedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    });
  }
  return posts;
}
