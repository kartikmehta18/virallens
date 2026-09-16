import { Eye, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { formatCount } from "@/lib/client/format";
import type { Post } from "@/lib/types";

export function Stats({ post, className = "", showViews = true }: { post: Post; className?: string; showViews?: boolean }) {
  const items = [
    { icon: Heart, value: post.likeCount, label: "likes" },
    { icon: MessageCircle, value: post.commentCount, label: "comments" },
    { icon: Repeat2, value: post.shareCount, label: "shares" },
    ...(showViews && post.viewCount ? [{ icon: Eye, value: post.viewCount, label: "views" }] : []),
  ];
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {items.map(({ icon: Icon, value, label }) => (
        <span key={label} className="flex items-center gap-1 tabular-nums" title={`${value.toLocaleString()} ${label}`}>
          <Icon className="size-3.5" />
          {formatCount(value)}
        </span>
      ))}
    </div>
  );
}
