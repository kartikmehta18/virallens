import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";

type Ctx = RouteContext<"/api/boards/[id]">;

export const GET = handler(async (request: NextRequest, ctx: Ctx) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const board = await (await getRepo()).boards.get(user.id, id);
  if (!board) throw new ApiError(404, "Board not found");
  return json(board);
});

export const PATCH = handler(async (request: NextRequest, ctx: Ctx) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const { name } = await readJson<{ name?: string }>(request);
  const trimmed = name?.trim().slice(0, 80);
  if (!trimmed) throw new ApiError(400, "Board name is required");
  if (!(await (await getRepo()).boards.rename(user.id, id, trimmed))) throw new ApiError(404, "Board not found");
  return json({ ok: true });
});

export const DELETE = handler(async (request: NextRequest, ctx: Ctx) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  if (!(await (await getRepo()).boards.remove(user.id, id))) throw new ApiError(404, "Board not found");
  return json({ ok: true });
});
