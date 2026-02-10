'use client'

import dynamic from 'next/dynamic'
import type { ContiWithSongsAndSheetMusic, ContiPdfExport } from '@/lib/types'

function PdfEditorSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-10 w-56 bg-muted animate-pulse rounded" />
          <div className="h-5 w-36 bg-muted animate-pulse rounded mt-3" />
        </div>
      </div>
      <div className="aspect-[1/1.414] w-full max-w-3xl mx-auto bg-muted animate-pulse rounded-lg" />
    </div>
  )
}

const PdfEditor = dynamic(
  () => import('@/components/contis/pdf-export/pdf-editor').then(m => ({ default: m.PdfEditor })),
  { ssr: false, loading: () => <PdfEditorSkeleton /> }
)

export function PdfEditorLoader({
  conti,
  existingExport,
}: {
  conti: ContiWithSongsAndSheetMusic
  existingExport: ContiPdfExport | null
}) {
  return <PdfEditor conti={conti} existingExport={existingExport} />
}
