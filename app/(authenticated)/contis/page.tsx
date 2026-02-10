import Link from "next/link"
import { getContis } from "@/lib/queries/contis"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { ContiList } from "@/components/contis/conti-list"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

export default async function ContisPage() {
  const contis = await getContis()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="콘티 목록">
        <Button size="icon" className="sm:hidden" aria-label="새 콘티 만들기"
          render={<Link href="/contis/new" />}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
        </Button>
        <Button className="hidden sm:inline-flex"
          render={<Link href="/contis/new" />}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          새 콘티 만들기
        </Button>
      </PageHeader>
      <ContiList contis={contis} />
    </div>
  )
}
