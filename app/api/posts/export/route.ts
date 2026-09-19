import type { NextRequest } from "next/server";
import { handler } from "@/lib/http";
import { parsePostQuery } from "@/lib/query";
import { getRepo } from "@/lib/repo";
import type { Post } from "@/lib/types";

const COLUMNS: (keyof Post)[] = [
  "platform",
  "authorName",
  "authorHandle",
  "caption",
  "mediaType",
  "postUrl",
  "likeCount",
  "commentCount",
  "shareCount",
  "viewCount",
  "engagementScore",
  "trendingScore",
  "memeScore",
  "topic",
  "tags",
  "publishedAt",
];

const cell = (value: unknown) => {
  const text = Array.isArray(value) ? value.join(" ") : value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** GET /api/posts/export — CSV of the current filtered result set (up to 1000 rows). */
export const GET = handler(async (request: NextRequest) => {
  const repo = await getRepo();
  const query = { ...parsePostQuery(request.nextUrl.searchParams), page: 1, limit: 1000 };
  const { items } = await repo.posts.search(query);
  const csv = [COLUMNS.join(","), ...items.map((post) => COLUMNS.map((col) => cell(post[col])).join(","))].join("\n");
  const name = `virallens-${(query.topic ?? "all").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(`﻿${csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
});
