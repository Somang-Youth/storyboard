import { notFound } from "next/navigation"
import Link from "next/link"
import { getConti } from "@/lib/queries/contis"
import { getSongs } from "@/lib/queries/songs"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { ContiDetail } from "@/components/contis/conti-detail"
import { ContiDeleteButton } from "@/components/contis/conti-delete-button"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"

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
  const [conti, allSongs] = await Promise.all([getConti(id), getSongs()])

  if (!conti) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={conti.title || formatDate(conti.date)} description={formatDate(conti.date)}>
        <Button variant="outline" render={<Link href={`/contis/${conti.id}/edit`} />}>
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} data-icon="inline-start" />
          편집
        </Button>
        <ContiDeleteButton contiId={conti.id} />
      </PageHeader>
      <ContiDetail conti={conti} allSongs={allSongs} />
    </div>
  )
}
