import "server-only";
import { randomUUID } from "node:crypto";
import { scorePost } from "../scoring";
import { creatorKey } from "../creators";
import type { BoardSummary, FavoriteCreator, Post, ScrapeJob, WatchedTopic } from "../types";
import { parseSearch, postHaystack } from "../search";
import { matchesQuery, rankPosts, searchTier, summarizeCreators } from "./shared";
import type { Repository, StoredInvite, StoredUser } from "./types";

interface MemoryBoard {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  postIds: string[];
}

interface MemoryState {
  posts: Map<string, Post>;
  postIdByUrl: Map<string, string>;
  users: Map<string, StoredUser>;
  boards: Map<string, MemoryBoard>;
  jobs: Map<string, ScrapeJob>;
  watches: Map<string, WatchedTopic>;
  alerts: Set<string>;
  creators: Map<string, FavoriteCreator>;
  invites: Map<string, StoredInvite>;
}

// Kept on globalThis so the store survives hot reloads in development.
const globalStore = globalThis as unknown as { __viralLensMemory?: MemoryState };
const state: MemoryState = (globalStore.__viralLensMemory ??= {
  posts: new Map(),
  postIdByUrl: new Map(),
  users: new Map(),
  boards: new Map(),
  jobs: new Map(),
  watches: new Map(),
  alerts: new Set(),
  creators: new Map(),
  invites: new Map(),
});
// Stores created before the creators feature existed (hot reload) lack the map.
state.creators ??= new Map();
state.invites ??= new Map();

const id = () => randomUUID().replace(/-/g, "").slice(0, 25);
const now = () => new Date().toISOString();

function summarize(board: MemoryBoard): BoardSummary {
  const covers = board.postIds
    .map((postId) => state.posts.get(postId)?.thumbnailUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 4);
  return { id: board.id, name: board.name, createdAt: board.createdAt, postCount: board.postIds.length, covers };
}

function ownedBoard(userId: string, boardId: string) {
  const board = state.boards.get(boardId);
  return board && board.userId === userId ? board : null;
}

export const memoryRepository: Repository = {
  kind: "memory",

  posts: {
    async upsertMany(inputs) {
      const saved: Post[] = [];
      const createdIds: string[] = [];
      for (const input of inputs) {
        const existingId = state.postIdByUrl.get(input.postUrl);
        const existing = existingId ? state.posts.get(existingId) : undefined;
        const post: Post = {
          ...input,
          ...scorePost(input),
          id: existing?.id ?? id(),
          aiBreakdown: existing?.aiBreakdown ?? null,
          fetchedAt: now(),
        };
        state.posts.set(post.id, post);
        state.postIdByUrl.set(post.postUrl, post.id);
        if (!existing) createdIds.push(post.id);
        saved.push(post);
      }
      return { posts: saved, createdIds };
    },

    async search(query) {
      const parsed = query.topic ? parseSearch(query.topic) : null;
      const prefer = new Set((query.preferCreators ?? []).map(creatorKey));
      const matches = rankPosts(
        [...state.posts.values()].filter((post) => matchesQuery(post, query, parsed)),
        query.sort,
        parsed ? (post) => searchTier(post, parsed, prefer) : undefined,
      );
      const start = (query.page - 1) * query.limit;
      const items = matches.slice(start, start + query.limit);
      return {
        items,
        page: query.page,
        limit: query.limit,
        total: matches.length,
        hasMore: start + items.length < matches.length,
        ...(prefer.size && {
          creatorMatches: matches.filter((p) => prefer.has(creatorKey({ platform: p.platform, handle: p.authorHandle }))).length,
        }),
      };
    },

    async byId(postId) {
      return state.posts.get(postId) ?? null;
    },

    async similarCandidates({ excludeId, patterns, minMatch, limit }) {
      const regexes = patterns.map((p) => new RegExp(p, "iu"));
      return [...state.posts.values()]
        .filter((post) => post.id !== excludeId)
        .map((post) => ({ post, matched: regexes.filter((r) => r.test(postHaystack(post))).length }))
        .filter((c) => c.matched >= minMatch && c.matched > 0)
        .sort((a, b) => b.matched - a.matched || b.post.trendingScore - a.post.trendingScore)
        .slice(0, limit)
        .map((c) => c.post);
    },

    async oldestPublished(platform, { topic, authorHandle }) {
      let oldest: string | null = null;
      for (const post of state.posts.values()) {
        if (post.platform !== platform) continue;
        if (topic && post.topic.toLowerCase() !== topic.toLowerCase()) continue;
        if (authorHandle && post.authorHandle.toLowerCase() !== authorHandle.toLowerCase()) continue;
        if (!oldest || post.publishedAt < oldest) oldest = post.publishedAt;
      }
      return oldest;
    },

    async timelineSource(topic, platforms, since, creators) {
      const query = { topic, platforms, creators, from: since, sort: ["newest" as const], page: 1, limit: 1 };
      const parsed = topic ? parseSearch(topic) : null;
      return [...state.posts.values()].filter((post) => matchesQuery(post, query, parsed));
    },

    async setBreakdown(postId, breakdown) {
      const post = state.posts.get(postId);
      if (post) post.aiBreakdown = breakdown;
    },

    async rescoreSince(since) {
      let count = 0;
      for (const post of state.posts.values()) {
        if (new Date(post.publishedAt) < since) continue;
        Object.assign(post, scorePost(post));
        count++;
      }
      return count;
    },

    async count() {
      return state.posts.size;
    },
    async creatorStats(refs) {
      return summarizeCreators([...state.posts.values()], refs);
    },
  },

  creators: {
    async list(userId) {
      return [...state.creators.values()].filter((c) => c.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(userId, ref) {
      const key = creatorKey(ref);
      return [...state.creators.values()].find((c) => c.userId === userId && creatorKey(c) === key) ?? null;
    },
    async add(userId, data) {
      const existing = await memoryRepository.creators.get(userId, data);
      const creator: FavoriteCreator = existing
        ? { ...existing, name: data.name, avatarUrl: data.avatarUrl ?? existing.avatarUrl }
        : { ...data, handle: data.handle.toLowerCase(), id: id(), userId, lastFetchedAt: null, createdAt: now() };
      state.creators.set(creator.id, creator);
      return creator;
    },
    async remove(userId, creatorId) {
      const creator = state.creators.get(creatorId);
      return Boolean(creator && creator.userId === userId) && state.creators.delete(creatorId);
    },
    async markFetched(ref, at, identity) {
      const key = creatorKey(ref);
      for (const c of state.creators.values()) {
        if (creatorKey(c) !== key) continue;
        c.lastFetchedAt = at.toISOString();
        if (identity?.name && c.name.toLowerCase() === c.handle) c.name = identity.name;
        if (identity?.avatarUrl && !c.avatarUrl) c.avatarUrl = identity.avatarUrl;
      }
    },
  },

  users: {
    async byId(userId) {
      return state.users.get(userId) ?? null;
    },
    async byEmail(email) {
      const needle = email.toLowerCase();
      return [...state.users.values()].find((user) => user.email?.toLowerCase() === needle) ?? null;
    },
    async byUsername(username) {
      const needle = username.toLowerCase();
      return [...state.users.values()].find((user) => user.username === needle) ?? null;
    },
    async byAccessKeyHash(hash) {
      return [...state.users.values()].find((user) => user.accessKeyHash === hash) ?? null;
    },
    async byGoogleId(googleId) {
      return [...state.users.values()].find((user) => user.googleId === googleId) ?? null;
    },
    async create(data) {
      const user: StoredUser = {
        id: data.id ?? id(),
        username: data.username?.toLowerCase() ?? null,
        email: data.email?.toLowerCase() || null,
        name: data.name,
        role: data.role ?? "user",
        avatarUrl: data.avatarUrl ?? null,
        passwordHash: data.passwordHash,
        googleId: data.googleId ?? null,
        isTest: data.isTest,
        disabled: false,
        accessKeyHash: null,
        accessKeyCipher: null,
        accessKeyCreatedAt: null,
        sessionVersion: 0,
        lastLoginAt: null,
        invitedById: data.invitedById ?? null,
        createdAt: now(),
      };
      state.users.set(user.id, user);
      return user;
    },
    async list() {
      return [...state.users.values()].filter((u) => !u.isTest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async update(userId, patch) {
      const user = state.users.get(userId);
      if (!user) return null;
      const { bumpSessionVersion, accessKeyCreatedAt, lastLoginAt, ...rest } = patch;
      Object.assign(user, rest);
      if (rest.username !== undefined) user.username = rest.username?.toLowerCase() ?? null;
      if (rest.email !== undefined) user.email = rest.email?.toLowerCase() || null;
      if (accessKeyCreatedAt !== undefined) user.accessKeyCreatedAt = accessKeyCreatedAt?.toISOString() ?? null;
      if (lastLoginAt) user.lastLoginAt = lastLoginAt.toISOString();
      if (bumpSessionVersion) user.sessionVersion++;
      return user;
    },
    async remove(userId) {
      return state.users.delete(userId);
    },
    async countAdmins() {
      return [...state.users.values()].filter((u) => u.role === "admin" && !u.disabled).length;
    },
  },

  invites: {
    async create(data) {
      const invite: StoredInvite = { ...data, id: id(), usedAt: null, usedById: null, createdAt: now() };
      state.invites.set(invite.id, invite);
      return invite;
    },
    async list() {
      return [...state.invites.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async byTokenHash(hash) {
      return [...state.invites.values()].find((invite) => invite.tokenHash === hash) ?? null;
    },
    async markUsed(inviteId, userId) {
      const invite = state.invites.get(inviteId);
      if (!invite || invite.usedAt) return false;
      Object.assign(invite, { usedAt: now(), usedById: userId });
      return true;
    },
    async remove(inviteId) {
      return state.invites.delete(inviteId);
    },
  },

  boards: {
    async list(userId) {
      return [...state.boards.values()]
        .filter((board) => board.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(summarize);
    },
    async get(userId, boardId) {
      const board = ownedBoard(userId, boardId);
      if (!board) return null;
      const posts = board.postIds.map((postId) => state.posts.get(postId)).filter((p): p is Post => Boolean(p));
      return { ...summarize(board), posts: posts.reverse() };
    },
    async create(userId, name) {
      const board: MemoryBoard = { id: id(), name, userId, createdAt: now(), postIds: [] };
      state.boards.set(board.id, board);
      return summarize(board);
    },
    async rename(userId, boardId, name) {
      const board = ownedBoard(userId, boardId);
      if (board) board.name = name;
      return Boolean(board);
    },
    async remove(userId, boardId) {
      return Boolean(ownedBoard(userId, boardId)) && state.boards.delete(boardId);
    },
    async addPost(userId, boardId, postId) {
      const board = ownedBoard(userId, boardId);
      if (!board || !state.posts.has(postId)) return false;
      if (!board.postIds.includes(postId)) board.postIds.push(postId);
      return true;
    },
    async removePost(userId, boardId, postId) {
      const board = ownedBoard(userId, boardId);
      if (!board) return false;
      board.postIds = board.postIds.filter((p) => p !== postId);
      return true;
    },
    async savedMap(userId) {
      const map: Record<string, string[]> = {};
      for (const board of state.boards.values()) {
        if (board.userId !== userId) continue;
        for (const postId of board.postIds) (map[postId] ??= []).push(board.id);
      }
      return map;
    },
  },

  jobs: {
    async create(data) {
      const job: ScrapeJob = { ...data, id: id(), status: "queued", error: null, postsFound: 0, createdAt: now(), finishedAt: null };
      state.jobs.set(job.id, job);
      return job;
    },
    async update(jobId, data) {
      const job = state.jobs.get(jobId);
      if (job) Object.assign(job, data);
    },
    async get(jobId) {
      const job = state.jobs.get(jobId);
      return job ? structuredClone(job) : null;
    },
  },

  watches: {
    async list(userId) {
      return [...state.watches.values()].filter((w) => w.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async all() {
      return [...state.watches.values()].map((w) => ({ ...w, userEmail: state.users.get(w.userId)?.email ?? "" }));
    },
    async upsert(userId, data) {
      const existing = [...state.watches.values()].find((w) => w.userId === userId && w.topic.toLowerCase() === data.topic.toLowerCase());
      const watch: WatchedTopic = existing
        ? { ...existing, ...data }
        : { ...data, id: id(), userId, lastCheckedAt: null, createdAt: now() };
      state.watches.set(watch.id, watch);
      return watch;
    },
    async remove(userId, watchId) {
      const watch = state.watches.get(watchId);
      return Boolean(watch && watch.userId === userId) && state.watches.delete(watchId);
    },
    async markChecked(watchId, at) {
      const watch = state.watches.get(watchId);
      if (watch) watch.lastCheckedAt = at.toISOString();
    },
    async recordAlert(watchId, postId) {
      const key = `${watchId}:${postId}`;
      if (state.alerts.has(key)) return false;
      state.alerts.add(key);
      return true;
    },
  },
};
