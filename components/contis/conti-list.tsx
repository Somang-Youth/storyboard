"use client"

import type { Conti } from "@/lib/types"
import { ContiCard } from "@/components/contis/conti-card"

export function ContiList({ contis }: { contis: Conti[] }) {
  if (contis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-base">콘티가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {contis.map((conti) => (
        <ContiCard key={conti.id} conti={conti} />
      ))}
    </div>
  )
}
