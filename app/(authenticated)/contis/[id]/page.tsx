import { notFound } from "next/navigation"
import Link from "next/link"
import { getConti, getContiPdfExport } from "@/lib/queries/contis"
import { getSongs } from "@/lib/queries/songs"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { ContiDetail } from "@/components/contis/conti-detail"
import { ContiDeleteButton } from "@/components/contis/conti-delete-button"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, FileExportIcon, Download04Icon } from "@hugeicons/core-free-icons"

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}년 ${month}월 ${day}일`
}

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
        <Button variant="outline" size="icon" className="sm:hidden" aria-label="PDF 내보내기"
          render={<Link href={`/contis/${conti.id}/export`} />}>
          <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} />
        </Button>
        <Button variant="outline" className="hidden sm:inline-flex"
          render={<Link href={`/contis/${conti.id}/export`} />}>
          <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
          PDF 내보내기
        </Button>
        {/* PDF 다운로드 */}
        {pdfExport?.pdfUrl && (
          <>
            <Button variant="outline" size="icon" className="sm:hidden" aria-label="PDF 다운로드"
              render={<a href={pdfExport.pdfUrl} target="_blank" rel="noopener" />}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} />
            </Button>
            <Button variant="outline" className="hidden sm:inline-flex"
              render={<a href={pdfExport.pdfUrl} target="_blank" rel="noopener" />}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              PDF 다운로드
            </Button>
          </>
        )}
        {/* 편집 */}
        <Button variant="outline" size="icon" className="sm:hidden" aria-label="편집"
          render={<Link href={`/contis/${conti.id}/edit`} />}>
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
        </Button>
        <Button variant="outline" className="hidden sm:inline-flex"
          render={<Link href={`/contis/${conti.id}/edit`} />}>
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} data-icon="inline-start" />
          편집
        </Button>
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
