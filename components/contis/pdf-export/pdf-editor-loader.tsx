'use client'

import dynamic from 'next/dynamic'
import type { ContiWithSongsAndSheetMusic, ContiPdfExport } from '@/lib/types'

function PdfEditorSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-10 w-full bg-muted animate-pulse rounded" />
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
