import type { Post } from "../types";

export function breakdownPrompt(post: Post): string {
  const media =
    post.mediaType === "text" ? "Text-only post (no media)." : `${post.mediaType} post with ${post.mediaUrls.length || 1} media item(s).`;
  return [
    `Platform: ${post.platform}`,
    `Author: ${post.authorName} (@${post.authorHandle})`,
    `Format: ${media}`,
    `Engagement: ${post.likeCount} likes, ${post.commentCount} comments, ${post.shareCount} shares${post.viewCount ? `, ${post.viewCount} views` : ""}`,
    `Published: ${post.publishedAt}`,
    `Hashtags: ${post.tags.map((t) => `#${t}`).join(" ") || "none"}`,
    "",
    "Caption:",
    post.caption || "(no caption)",
  ].join("\n");
}

export const BREAKDOWN_SYSTEM =
  "You are a social media strategist. Given a post and its engagement stats, explain in 3-5 concise bullet points why it likely performed well. " +
  "Cover the hook, format, call-to-action, and emotional angle where relevant. Each bullet should be one or two sentences, specific to this post, " +
  "and actionable for a creator who wants to replicate the result. Do not use markdown in the bullets.";
