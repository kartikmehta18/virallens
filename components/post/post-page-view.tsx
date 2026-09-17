"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Post } from "@/lib/types";
import { PostDetail } from "./post-detail";

export function PostPageView({ post }: { post: Post }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1240px] px-3 py-5 sm:px-6">
      <Link href="/explore" className="text-muted hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Back to explore
      </Link>
      <PostDetail
        id={post.id}
        initialPost={post}
        mode="page"
        onSelectSimilar={(similar) => router.push(`/post/${similar.id}`, { scroll: false })}
      />
    </div>
  );
}
