import type {
  AiBreakdown,
  CreatorRef,
  CreatorStats,
  FavoriteCreator,
  BoardDetail,
  BoardSummary,
  Platform,
  Post,
  PostInput,
  PostPage,
  PostQuery,
  Role,
  ScrapeJob,
  User,
  WatchedTopic,
} from "../types";

export interface StoredUser extends User {
  passwordHash: string | null;
  googleId: string | null;
  disabled: boolean;
  accessKeyHash: string | null;
  accessKeyCipher: string | null;
  accessKeyCreatedAt: string | null;
  sessionVersion: number;
  lastLoginAt: string | null;
  invitedById: string | null;
}

export interface NewUser {
  id?: string;
  username: string | null;
  email: string | null;
  name: string | null;
  passwordHash: string | null;
  isTest: boolean;
  role?: Role;
  invitedById?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
}

export type UserPatch = Partial<{
  username: string | null;
  email: string | null;
  name: string | null;
  passwordHash: string | null;
  googleId: string | null;
  avatarUrl: string | null;
  invitedById: string | null;
  role: Role;
  disabled: boolean;
  isTest: boolean;
  accessKeyHash: string | null;
  accessKeyCipher: string | null;
  accessKeyCreatedAt: Date | null;
  lastLoginAt: Date;
}> & {
  /** Invalidates every existing session of the user. */
  bumpSessionVersion?: boolean;
};

export interface StoredInvite {
  id: string;
  tokenHash: string;
  tokenCipher: string;
  email: string | null;
  name: string | null;
  role: Role;
  createdById: string;
  expiresAt: string;
  usedAt: string | null;
  usedById: string | null;
  createdAt: string;
}

export interface CreatorSummary extends CreatorStats {
  name: string | null;
  avatarUrl: string | null;
}

export interface SimilarCandidateQuery {
  excludeId: string;
  topic: string;
  platform: Platform;
  tags: string[];
  limit: number;
}

/** Storage abstraction implemented by both the Prisma (MySQL) and in-memory backends. */
export interface Repository {
  kind: "prisma" | "memory";

  posts: {
    upsertMany(posts: PostInput[]): Promise<Post[]>;
    search(query: PostQuery): Promise<PostPage>;
    byId(id: string): Promise<Post | null>;
    similarCandidates(query: SimilarCandidateQuery): Promise<Post[]>;
    timelineSource(
      topic: string | undefined,
      platforms: Platform[] | undefined,
      since: Date,
      creators?: CreatorRef[],
    ): Promise<Pick<Post, "publishedAt" | "engagementScore">[]>;
    setBreakdown(id: string, breakdown: AiBreakdown): Promise<void>;
    rescoreSince(since: Date): Promise<number>;
    count(): Promise<number>;
    /** Aggregate stats plus latest display name/avatar for each creator, keyed by creatorKey(). */
    creatorStats(refs: CreatorRef[]): Promise<Record<string, CreatorSummary>>;
  };

  users: {
    byId(id: string): Promise<StoredUser | null>;
    byEmail(email: string): Promise<StoredUser | null>;
    byUsername(username: string): Promise<StoredUser | null>;
    byAccessKeyHash(hash: string): Promise<StoredUser | null>;
    byGoogleId(googleId: string): Promise<StoredUser | null>;
    create(data: NewUser): Promise<StoredUser>;
    /** Server accounts only (test-mode local mirrors are excluded), newest first. */
    list(): Promise<StoredUser[]>;
    update(id: string, patch: UserPatch): Promise<StoredUser | null>;
    remove(id: string): Promise<boolean>;
    countAdmins(): Promise<number>;
  };

  invites: {
    create(data: Omit<StoredInvite, "id" | "usedAt" | "usedById" | "createdAt">): Promise<StoredInvite>;
    list(): Promise<StoredInvite[]>;
    byTokenHash(hash: string): Promise<StoredInvite | null>;
    /** Atomically claims an unused invite; false if it was already used. */
    markUsed(id: string, userId: string): Promise<boolean>;
    remove(id: string): Promise<boolean>;
  };

  boards: {
    list(userId: string): Promise<BoardSummary[]>;
    get(userId: string, boardId: string): Promise<BoardDetail | null>;
    create(userId: string, name: string): Promise<BoardSummary>;
    rename(userId: string, boardId: string, name: string): Promise<boolean>;
    remove(userId: string, boardId: string): Promise<boolean>;
    addPost(userId: string, boardId: string, postId: string): Promise<boolean>;
    removePost(userId: string, boardId: string, postId: string): Promise<boolean>;
    /** postId -> boardIds the post is saved in */
    savedMap(userId: string): Promise<Record<string, string[]>>;
  };

  jobs: {
    create(data: Pick<ScrapeJob, "topic" | "platforms" | "userId" | "runs">): Promise<ScrapeJob>;
    update(id: string, data: Partial<Pick<ScrapeJob, "status" | "error" | "postsFound" | "runs" | "finishedAt">>): Promise<void>;
    get(id: string): Promise<ScrapeJob | null>;
  };

  creators: {
    list(userId: string): Promise<FavoriteCreator[]>;
    get(userId: string, ref: CreatorRef): Promise<FavoriteCreator | null>;
    /** Saves (or refreshes the name/avatar of) a favorite creator. */
    add(userId: string, data: CreatorRef & { name: string; avatarUrl: string | null }): Promise<FavoriteCreator>;
    remove(userId: string, id: string): Promise<boolean>;
    /** Stamps lastFetchedAt and fills in a real name/avatar where favorites only had the handle. */
    markFetched(ref: CreatorRef, at: Date, identity?: { name: string | null; avatarUrl: string | null }): Promise<void>;
  };

  watches: {
    list(userId: string): Promise<WatchedTopic[]>;
    all(): Promise<(WatchedTopic & { userEmail: string | null })[]>;
    upsert(userId: string, data: Pick<WatchedTopic, "topic" | "platforms" | "thresholdScore">): Promise<WatchedTopic>;
    remove(userId: string, id: string): Promise<boolean>;
    markChecked(id: string, at: Date): Promise<void>;
    /** Records an alert; returns false if this post already triggered an alert for the watch. */
    recordAlert(watchId: string, postId: string): Promise<boolean>;
  };
}
