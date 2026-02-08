"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { updateContiSong } from "@/lib/actions/conti-songs"

interface SectionLyricsMapperProps {
  contiSongId: string
  sectionOrder: string[]
  lyrics: string[]
  initialMap: Record<number, number[]>
}

export function SectionLyricsMapper({
  contiSongId,
  sectionOrder,
  lyrics,
  initialMap,
}: SectionLyricsMapperProps) {
  const [sectionLyricsMap, setSectionLyricsMap] =
    useState<Record<number, number[]>>(initialMap)
  const [isPending, setIsPending] = useState(false)

  const toggleLyricsForSection = (sectionIndex: number, lyricsIndex: number) => {
    const currentLyrics = sectionLyricsMap[sectionIndex] || []
    const newLyrics = currentLyrics.includes(lyricsIndex)
      ? currentLyrics.filter((i) => i !== lyricsIndex)
      : [...currentLyrics, lyricsIndex].sort((a, b) => a - b)

    if (newLyrics.length === 0) {
      const newMap = { ...sectionLyricsMap }
      delete newMap[sectionIndex]
      setSectionLyricsMap(newMap)
    } else {
      setSectionLyricsMap({
        ...sectionLyricsMap,
        [sectionIndex]: newLyrics,
      })
    }
  }

  const handleSave = async () => {
    setIsPending(true)
    try {
      const result = await updateContiSong(contiSongId, { sectionLyricsMap })
      if (result.success) {
        toast.success("섹션-가사 매핑이 저장되었습니다")
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  if (sectionOrder.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        먼저 섹션 순서를 설정하세요
      </p>
    )
  }

  if (lyrics.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        먼저 가사 페이지를 추가하세요
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {sectionOrder.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className="ring-foreground/10 rounded-lg bg-muted/50 p-3 ring-1"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                [{sectionIndex}]
              </span>
              <span className="text-sm font-medium">{section}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lyrics.map((_, lyricsIndex) => {
                const isSelected =
                  sectionLyricsMap[sectionIndex]?.includes(lyricsIndex) || false
                return (
                  <label
                    key={lyricsIndex}
                    className="flex cursor-pointer items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        toggleLyricsForSection(sectionIndex, lyricsIndex)
                      }
                      className="size-4 cursor-pointer rounded"
                    />
                    <span className="text-sm">페이지 {lyricsIndex + 1}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">미리보기</div>
        <div className="ring-foreground/10 space-y-2 rounded-lg bg-muted/30 p-3 ring-1">
          {sectionOrder.map((section, sectionIndex) => {
            const lyricsIndices = sectionLyricsMap[sectionIndex] || []
            if (lyricsIndices.length === 0) {
              return (
                <div key={sectionIndex} className="flex items-start gap-2">
                  <span className="text-muted-foreground text-xs">
                    [{sectionIndex}] {section}:
                  </span>
                  <span className="text-muted-foreground text-xs italic">
                    가사 없음
                  </span>
                </div>
              )
            }
            return (
              <div key={sectionIndex} className="flex items-start gap-2">
                <span className="text-muted-foreground text-xs">
                  [{sectionIndex}] {section}:
                </span>
                <div className="flex flex-wrap gap-1">
                  {lyricsIndices.map((lyricsIndex) => (
                    <Badge key={lyricsIndex} variant="secondary" className="text-xs">
                      페이지 {lyricsIndex + 1}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Button onClick={handleSave} disabled={isPending} className="w-full">
        저장
      </Button>
    </div>
  )
}
