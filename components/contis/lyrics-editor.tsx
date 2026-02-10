"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon } from "@hugeicons/core-free-icons"
interface LyricsEditorProps {
  initialLyrics: string[]
  onSave: (data: { lyrics: string[] }) => Promise<{ success: boolean; error?: string }>
}

export function LyricsEditor({
  initialLyrics,
  onSave,
}: LyricsEditorProps) {
  const [lyrics, setLyrics] = useState<string[]>(initialLyrics)
  const [isPending, setIsPending] = useState(false)

  const addPage = () => {
    setLyrics([...lyrics, ""])
  }

  const removePage = (index: number) => {
    setLyrics(lyrics.filter((_, i) => i !== index))
  }

  const updatePage = (index: number, value: string) => {
    const newLyrics = [...lyrics]
    newLyrics[index] = value
    setLyrics(newLyrics)
  }

  const handleSave = async () => {
    setIsPending(true)
    try {
      const result = await onSave({ lyrics })
      if (result.success) {
        toast.success("가사가 저장되었습니다")
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-base font-medium">가사 페이지</div>
        <Button size="xs" onClick={addPage}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          페이지 추가
        </Button>
      </div>

      <div className="space-y-4">
        {lyrics.map((lyric, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-sm font-medium">
                페이지 {index + 1}
              </label>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => removePage(index)}
                aria-label="삭제"
              >
                <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
              </Button>
            </div>
            <Textarea
              value={lyric}
              onChange={(e) => updatePage(index, e.target.value)}
              placeholder="가사를 입력하세요..."
              rows={3}
            />
          </div>
        ))}
        {lyrics.length === 0 && (
          <p className="text-muted-foreground text-base">
            가사 페이지를 추가하세요
          </p>
        )}
      </div>

      <Button onClick={handleSave} disabled={isPending} className="w-full">
        저장
      </Button>
    </div>
  )
}
