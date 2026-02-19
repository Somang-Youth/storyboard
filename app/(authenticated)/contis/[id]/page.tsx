import { notFound } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getConti, getContiPdfExport } from "@/lib/queries/contis"
import { getSongs } from "@/lib/queries/songs"
import { PageHeader } from "@/components/layout/page-header"
import { ContiDetail } from "@/components/contis/conti-detail"
import { ContiDeleteButton } from "@/components/contis/conti-delete-button"
import { PptxExportButton } from "@/components/contis/pptx-export-button"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, FileExportIcon, Download04Icon } from "@hugeicons/core-free-icons"

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}년 ${month}월 ${day}일`
}

const outlineButtonClass =
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-border bg-background bg-clip-padding text-base font-medium focus-visible:ring-3 aria-invalid:ring-3 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 outline-none select-none hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"

const iconButtonClass = "size-9"
const defaultButtonClass = "h-9 gap-1.5 px-3.5"

export default async function ContiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [conti, allSongs, pdfExport] = await Promise.all([
    getConti(id),
    getSongs(),
    getContiPdfExport(id),
  ])

  if (!conti) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={conti.title || formatDate(conti.date)} description={formatDate(conti.date)}>
        {/* PDF 내보내기 */}
        <Link
          href={`/contis/${conti.id}/export`}
          aria-label="PDF 내보내기"
          className={cn(outlineButtonClass, iconButtonClass, "sm:hidden")}
        >
          <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} />
        </Link>
        <Link
          href={`/contis/${conti.id}/export`}
          className={cn(outlineButtonClass, defaultButtonClass, "hidden sm:inline-flex")}
        >
          <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
          PDF 내보내기
        </Link>
        {/* PDF 다운로드 */}
        {pdfExport?.pdfUrl && (
          <>
            <a
              href={pdfExport.pdfUrl}
              target="_blank"
              rel="noopener"
              aria-label="PDF 다운로드"
              className={cn(outlineButtonClass, iconButtonClass, "sm:hidden")}
            >
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} />
            </a>
            <a
              href={pdfExport.pdfUrl}
              target="_blank"
              rel="noopener"
              className={cn(outlineButtonClass, defaultButtonClass, "hidden sm:inline-flex")}
            >
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              PDF 다운로드
            </a>
          </>
        )}
        {/* PPT 내보내기 */}
        <span className="sm:hidden">
          <PptxExportButton conti={conti} iconOnly />
        </span>
        <span className="hidden sm:inline-flex">
          <PptxExportButton conti={conti} />
        </span>
        {/* 편집 */}
        <Link
          href={`/contis/${conti.id}/edit`}
          aria-label="편집"
          className={cn(outlineButtonClass, iconButtonClass, "sm:hidden")}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
        </Link>
        <Link
          href={`/contis/${conti.id}/edit`}
          className={cn(outlineButtonClass, defaultButtonClass, "hidden sm:inline-flex")}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} data-icon="inline-start" />
          편집
        </Link>
        {/* 삭제 */}
        <span className="sm:hidden">
          <ContiDeleteButton contiId={conti.id} iconOnly />
        </span>
        <span className="hidden sm:inline-flex">
          <ContiDeleteButton contiId={conti.id} />
        </span>
      </PageHeader>
      <ContiDetail conti={conti} allSongs={allSongs} />
    </div>
  )
}
