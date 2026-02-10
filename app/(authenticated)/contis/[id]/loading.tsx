import { Skeleton } from "@/components/ui/skeleton"

export default function ContiDetailLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
        </div>
      </div>
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
