import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostPageView } from "@/components/post/post-page-view";
import { getRepo } from "@/lib/repo";

async function loadPost(id: string) {
  return (await getRepo()).posts.byId(id);
}

export async function generateMetadata({ params }: PageProps<"/post/[id]">): Promise<Metadata> {
  const post = await loadPost((await params).id);
  if (!post) return { title: "Post not found" };
  return {
    title: `${post.authorName} on ${post.platform === "x" ? "X" : post.platform === "linkedin" ? "LinkedIn" : "Instagram"}`,
    description: post.caption.slice(0, 160),
    openGraph: post.thumbnailUrl ? { images: [post.thumbnailUrl] } : undefined,
  };
}

/** Direct visit / refresh of /post/[id]: full page (the intercepted route renders the modal instead). */
export default async function PostPage({ params }: PageProps<"/post/[id]">) {
  const post = await loadPost((await params).id);
  if (!post) notFound();
  return <PostPageView post={post} />;
}
