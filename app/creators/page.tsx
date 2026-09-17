"use client";

import { ArrowUpRight, Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { RequireUser } from "@/components/auth/require-user";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { Avatar } from "@/components/post/avatar";
import { inputClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { PLATFORM_LABELS, filtersToParams, DEFAULT_FILTERS } from "@/lib/client/filters";
import { formatCount, ago } from "@/lib/client/format";
import { useCreatorMutations, useFavoriteCreators } from "@/lib/client/hooks";
import { creatorKey, creatorPath, parseCreatorInput } from "@/lib/creators";
import { PLATFORMS, type FavoriteCreatorWithStats, type Platform } from "@/lib/types";

export default function CreatorsPage() {
  return (
    <RequireUser title="creators">
      <CreatorsList />
    </RequireUser>
  );
}

function CreatorsList() {
  const { data: creators, isLoading } = useFavoriteCreators();
  const { add } = useCreatorMutations();
  const [platform, setPlatform] = useState<Platform>("x");
  const [input, setInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const ref = parseCreatorInput(input, platform);
    if (!ref) {
      setFormError("Enter a handle like @username or a profile URL");
      return;
    }
    setFormError(null);
    add.mutate(ref, {
      onSuccess: () => setInput(""),
      onError: (error) => setFormError(error.message),
    });
  };

  const exploreAll = creators?.length
    ? `/explore?${filtersToParams({ ...DEFAULT_FILTERS, creators: creators.map(creatorKey) })}`
    : "/explore";

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end gap-6">
        <div className="min-w-0">
          <h1 className="display text-[36px] sm:text-[44px]">
            Favorite <b>creators</b>
          </h1>
          <p className="text-muted mt-3 max-w-xl text-[15px]">
            The accounts you study. Open a profile, pull their latest posts, or filter Explore to just them.
          </p>
        </div>
        {Boolean(creators?.length) && (
          <Link href={exploreAll} className="btn-primary lg:ml-auto">
            See all their posts <ArrowUpRight className="size-4" />
          </Link>
        )}
      </div>

      <form onSubmit={onAdd} className="border-border bg-surface relative mt-8 border p-4 sm:mt-10 sm:p-5">
        <Crosshairs />
        <p className="text-[14px] font-medium">Add a creator</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="border-border flex shrink-0 rounded-md border p-1">
            {PLATFORMS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPlatform(p)}
                aria-pressed={platform === p}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-[13px] transition sm:flex-none ${
                  platform === p
                    ? "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <PlatformIcon platform={p} className="size-3.5" />
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="@handle or profile URL"
            aria-label="Creator handle or profile URL"
            className={`${inputClass} min-w-0 sm:flex-1`}
          />
          <button disabled={input.trim().length < 1 || add.isPending} className="btn-primary h-11 shrink-0">
            {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save creator
          </button>
        </div>
        {formError ? (
          <p className="mt-2 text-[13px] text-red-400">{formError}</p>
        ) : (
          <p className="text-muted mt-2 text-[12.5px]">
            Pasting a URL picks the platform automatically — or use the save button next to any author in a post.
          </p>
        )}
      </form>

      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-52 rounded-lg" />
          ))}
        </div>
      ) : !creators?.length ? (
        <div className="border-border relative mt-8 flex flex-col items-center border px-6 py-20 text-center">
          <Crosshairs />
          <Users className="text-muted size-7" />
          <p className="mt-4 font-medium">No favorite creators yet</p>
          <p className="text-muted mt-1 max-w-sm text-sm">
            Add one above, or open any post and tap the <b className="text-foreground font-medium">save creator</b> button next to the
            author.
          </p>
          <Link href="/explore" className="btn-secondary mt-6">
            Go to Explore
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {creators.map((creator, i) => (
            <motion.div key={creator.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <CreatorCard creator={creator} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreatorCard({ creator }: { creator: FavoriteCreatorWithStats }) {
  const { remove, fetchPosts } = useCreatorMutations();
  const [message, setMessage] = useState<string | null>(null);
  const fetching = fetchPosts.isPending && fetchPosts.variables?.handle === creator.handle;
  const { stats } = creator;

  const onFetch = () => {
    setMessage(null);
    fetchPosts.mutate(
      { platform: creator.platform, handle: creator.handle, name: creator.name, avatarUrl: creator.avatarUrl, force: true },
      {
        onSuccess: (result) => setMessage(`${result.postsFound} post${result.postsFound === 1 ? "" : "s"} fetched`),
        onError: (error) => setMessage(error.message),
      },
    );
  };

  return (
    <div className="border-border bg-surface hover:border-foreground/25 flex h-full flex-col rounded-lg border p-5 transition">
      <Link href={creatorPath(creator)} className="group flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <Avatar src={creator.avatarUrl} name={creator.name} className="size-12" />
          <span className="bg-background border-border absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border">
            <PlatformIcon platform={creator.platform} className="size-2.5" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold group-hover:underline">{creator.name}</p>
          <p className="text-muted truncate text-[13px]">@{creator.handle}</p>
        </div>
      </Link>

      <dl className="divide-border border-border mt-4 grid grid-cols-3 divide-x rounded-md border py-2.5 text-center">
        {[
          ["Posts", formatCount(stats.postCount)],
          ["Avg. eng.", formatCount(Math.round(stats.avgEngagement))],
          ["Likes", formatCount(stats.totalLikes)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 px-1">
            <dd className="text-[15px] font-semibold tabular-nums">{value}</dd>
            <dt className="text-muted truncate text-[11px]">{label}</dt>
          </div>
        ))}
      </dl>

      <p className="text-muted mt-3 text-[12px]" aria-live="polite">
        {message ?? (creator.lastFetchedAt ? `Fetched ${ago(creator.lastFetchedAt)}` : "Posts not fetched yet")}
      </p>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Link href={creatorPath(creator)} className="btn-secondary h-9 flex-1 px-3 whitespace-nowrap">
          Profile
        </Link>
        <button onClick={onFetch} disabled={fetching} className="btn-secondary h-9 flex-1 px-3 whitespace-nowrap">
          {fetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Fetch posts
        </button>
        <button
          onClick={() => confirm(`Remove @${creator.handle} from favorite creators?`) && remove.mutate(creator.id)}
          disabled={remove.isPending && remove.variables === creator.id}
          aria-label={`Remove @${creator.handle}`}
          title="Remove from favorites"
          className="text-muted grid size-9 shrink-0 place-items-center rounded-md transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
