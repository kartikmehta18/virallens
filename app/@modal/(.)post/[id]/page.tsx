import { PostModal } from "@/components/post/post-modal";

/** Soft navigation to /post/[id] is intercepted here and rendered as an overlay above the current page. */
export default async function InterceptedPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostModal id={id} />;
}
