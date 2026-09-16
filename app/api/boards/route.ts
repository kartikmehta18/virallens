import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const GET = handler(async (request: NextRequest) => {
  const user = await requireUser(request);
  return json({ items: await (await getRepo()).boards.list(user.id) });
});

/** POST /api/boards { name, postId? } — creates a board, optionally saving a post into it right away. */
export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser(request);
  const { name, postId } = await readJson<{ name?: string; postId?: string }>(request);
  const trimmed = name?.trim().slice(0, 80);
  if (!trimmed) throw new ApiError(400, "Board name is required");

  const repo = await getRepo();
  const board = await repo.boards.create(user.id, trimmed);
  if (postId) await repo.boards.addPost(user.id, board.id, postId);
  return json(postId ? { ...board, postCount: 1 } : board, { status: 201 });
});
