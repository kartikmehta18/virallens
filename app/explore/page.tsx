import { Suspense } from "react";
import { ExploreView } from "@/components/explore/explore-view";
import { GridSkeleton } from "@/components/grid/bento-grid";

export const metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          <GridSkeleton count={15} />
        </div>
      }
    >
      <ExploreView />
    </Suspense>
  );
}
