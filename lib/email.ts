import "server-only";
import { env } from "./env";
import type { Post } from "./types";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Sends a trending-post alert via Resend. Without RESEND_API_KEY the alert is logged instead. */
export async function sendAlertEmail(to: string, topic: string, posts: Post[]): Promise<void> {
  const subject = `🔥 ${posts.length} post${posts.length > 1 ? "s" : ""} trending in "${topic}"`;
  const items = posts
    .map(
      (post) => `<li style="margin-bottom:12px">
        <a href="${env.appUrl}/post/${post.id}"><strong>${escape(post.authorName)}</strong> on ${post.platform}</a><br/>
        <span style="color:#555">${escape(post.caption.slice(0, 160))}${post.caption.length > 160 ? "…" : ""}</span><br/>
        <small>❤ ${post.likeCount} · 💬 ${post.commentCount} · ↻ ${post.shareCount} · score ${Math.round(post.trendingScore)}</small>
      </li>`,
    )
    .join("");
  const html = `<div style="font-family:system-ui,sans-serif"><h2>${escape(subject)}</h2><ul style="padding-left:18px">${items}</ul>
    <p><a href="${env.appUrl}/explore?topic=${encodeURIComponent(topic)}">Open in ViralLens</a></p></div>`;

  if (!env.resendKey || to.endsWith("@local.test")) {
    console.info(
      `[virallens] Alert for ${to}: ${subject}`,
      posts.map((p) => `${env.appUrl}/post/${p.id}`),
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.alertFrom, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
