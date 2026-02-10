import { Skeleton } from "@/components/ui/skeleton"

export default function SongDetailLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
        </div>
      </div>
      <Skeleton className="h-8 w-20 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
        ))}
      </div>
    </div>
  )
}
