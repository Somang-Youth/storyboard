'use client'

import dynamic from 'next/dynamic'
import type { ContiWithSongsAndSheetMusic, ContiPdfExport } from '@/lib/types'

function PdfEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded mt-2" />
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
