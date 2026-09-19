/**
 * Recomputes Post.memeScore for every stored post with the current heuristic (lib/meme.ts).
 *
 *   npm run db:backfill-memes
 *
 * Run it once after the meme_score migration, and again whenever the heuristic changes. New and
 * re-scraped posts are scored automatically on save. Safe to re-run: it only writes changed scores.
 */
import "dotenv/config";
import { getPrisma } from "../lib/db/prisma";
import { env } from "../lib/env";
import { memeScore } from "../lib/meme";
import type { MediaType } from "../lib/types";

const PAGE = 500;

async function main() {
  if (!env.dbEnabled) throw new Error("Configure DB_* (or DATABASE_URL) first — there is nothing to backfill in memory mode.");
  const db = getPrisma();

  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  let memes = 0;
  for (;;) {
    const rows = await db.post.findMany({
      select: { id: true, caption: true, tags: true, mediaType: true, memeScore: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    for (const row of rows) {
      const score = memeScore({
        caption: row.caption,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        mediaType: row.mediaType as MediaType,
      });
      if (score > 0) memes++;
      if (score === row.memeScore) continue;
      await db.post.update({ where: { id: row.id }, data: { memeScore: score } });
      updated++;
    }
    console.log(`… ${scanned} posts scanned`);
  }

  console.log(`Done: ${scanned} posts scanned, ${updated} updated, ${memes} with a meme signal.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
