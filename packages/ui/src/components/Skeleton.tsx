import { Skeleton } from "./States";

/** Additive: a row skeleton for list-shaped loading states (orders, returns, addresses). */
export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
