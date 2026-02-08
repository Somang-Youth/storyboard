"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon } from "@hugeicons/core-free-icons"
interface SectionOrderEditorProps {
  initialSectionOrder: string[]
  onSave: (data: { sectionOrder: string[] }) => Promise<{ success: boolean; error?: string }>
}

const PRESET_SECTIONS = [
  { label: "Intro", value: "Intro" },
  { label: "V", value: "V" },
  { label: "C", value: "C" },
  { label: "B", value: "B" },
  { label: "Outro", value: "Outro" },
  { label: "Interlude", value: "Interlude" },
]

export function SectionOrderEditor({
  initialSectionOrder,
  onSave,
}: SectionOrderEditorProps) {
  const [sectionOrder, setSectionOrder] = useState<string[]>(initialSectionOrder)
  const [customSection, setCustomSection] = useState("")
  const [isPending, setIsPending] = useState(false)

  const addSection = (section: string) => {
    if (section.trim()) {
      setSectionOrder([...sectionOrder, section.trim()])
    }
  }

  const removeSection = (index: number) => {
    setSectionOrder(sectionOrder.filter((_, i) => i !== index))
  }

  const addCustomSection = () => {
    if (customSection.trim()) {
      addSection(customSection)
      setCustomSection("")
    }
  }

  const handleSave = async () => {
    setIsPending(true)
    try {
      const result = await onSave({ sectionOrder })
      if (result.success) {
        toast.success("섹션 순서가 저장되었습니다")
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-sm font-medium">프리셋 섹션</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_SECTIONS.map((preset) => (
            <Badge
              key={preset.value}
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() => addSection(preset.value)}
            >
              {preset.label}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">커스텀 섹션</div>
        <div className="flex gap-2">
          <Input
            value={customSection}
            onChange={(e) => setCustomSection(e.target.value)}
            placeholder="섹션 이름 입력"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCustomSection()
              }
            }}
          />
          <Button size="sm" onClick={addCustomSection}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            추가
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">섹션 순서</div>
        {sectionOrder.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {sectionOrder.map((section, index) => (
              <div
                key={index}
                className="ring-foreground/10 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 ring-1"
              >
                <span className="text-muted-foreground text-xs font-medium">
                  {index}
                </span>
                <span className="text-sm">{section}</span>
                <button
                  onClick={() => removeSection(index)}
                  className="text-muted-foreground hover:text-foreground ml-1"
                  aria-label="삭제"
                >
                  <HugeiconsIcon
                    icon={Delete01Icon}
                    strokeWidth={2}
                    className="size-3.5"
                  />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">섹션을 추가하세요</p>
        )}
      </div>

      <Button onClick={handleSave} disabled={isPending} className="w-full">
        저장
      </Button>
    </div>
  )
}
