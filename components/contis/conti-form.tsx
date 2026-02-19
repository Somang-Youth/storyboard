"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { DatePicker } from "@/components/ui/date-picker"
import { createConti, updateConti } from "@/lib/actions/contis"
import { sanitizeContiDescription } from "@/lib/conti-description"
import type { Conti } from "@/lib/types"

export function ContiForm({ conti }: { conti?: Conti }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState(conti?.title ?? "")
  const [date, setDate] = useState(conti?.date ?? "")
  const [description, setDescription] = useState(sanitizeContiDescription(conti?.description) ?? "")

  const isEdit = !!conti

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData()
    formData.set("title", title)
    formData.set("date", date)
    formData.set("description", description)

    startTransition(async () => {
      const result = isEdit
        ? await updateConti(conti.id, formData)
        : await createConti(formData)

      if (result.success) {
        toast.success(isEdit ? "콘티가 수정되었습니다" : "콘티가 생성되었습니다")
        if (isEdit) {
          router.push(`/contis/${conti.id}`)
        } else {
          router.push("/contis")
        }
      } else {
        toast.error(result.error ?? "오류가 발생했습니다")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel>제목 (선택사항)</FieldLabel>
          <Input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="콘티 제목을 입력하세요"
          />
        </Field>

        <Field>
          <FieldLabel>날짜</FieldLabel>
          <DatePicker value={date} onChange={setDate} />
        </Field>

        <Field>
          <FieldLabel>설명 (선택사항)</FieldLabel>
          <Textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="콘티에 대한 설명을 입력하세요"
            rows={3}
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            취소
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
