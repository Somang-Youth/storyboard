import { PageHeader } from "@/components/layout/page-header"
import { ContiForm } from "@/components/contis/conti-form"

export default function NewContiPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="새 콘티 만들기" />
      <ContiForm />
    </div>
  )
}
