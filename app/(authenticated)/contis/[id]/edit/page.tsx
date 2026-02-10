import { notFound } from "next/navigation"
import { getConti } from "@/lib/queries/contis"
import { PageHeader } from "@/components/layout/page-header"
import { ContiForm } from "@/components/contis/conti-form"

export default async function EditContiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const conti = await getConti(id)

  if (!conti) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="콘티 편집" />
      <ContiForm conti={conti} />
    </div>
  )
}
