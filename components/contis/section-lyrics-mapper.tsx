"use client"

import { useState, useRef, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
interface SectionLyricsMapperProps {
  sectionOrder: string[]
  lyrics: string[]
  initialMap: Record<number, number[]>
  onChange: (data: { sectionLyricsMap: Record<number, number[]> }) => void
}

export function SectionLyricsMapper({
  sectionOrder,
  lyrics,
  initialMap,
  onChange,
}: SectionLyricsMapperProps) {
  const [sectionLyricsMap, setSectionLyricsMap] =
    useState<Record<number, number[]>>(initialMap)

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onChangeRef.current({ sectionLyricsMap })
  }, [sectionLyricsMap])

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

  if (sectionOrder.length === 0) {
    return (
      <p className="text-muted-foreground text-base">
        먼저 섹션 순서를 설정하세요
      </p>
    )
  }

  if (lyrics.length === 0) {
    return (
      <p className="text-muted-foreground text-base">
        먼저 가사 페이지를 추가하세요
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {sectionOrder.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className="ring-foreground/10 rounded-lg bg-muted/50 p-4 ring-1"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="text-muted-foreground text-sm font-medium">
                [{sectionIndex}]
              </span>
              <span className="text-base font-medium">{section}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lyrics.map((_, lyricsIndex) => {
                const isSelected =
                  sectionLyricsMap[sectionIndex]?.includes(lyricsIndex) || false
                return (
                  <label
                    key={lyricsIndex}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        toggleLyricsForSection(sectionIndex, lyricsIndex)
                      }
                      className="size-5 cursor-pointer rounded"
                    />
                    <span className="text-base">페이지 {lyricsIndex + 1}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 text-base font-medium">미리보기</div>
        <div className="ring-foreground/10 space-y-3 rounded-lg bg-muted/30 p-4 ring-1">
          {sectionOrder.map((section, sectionIndex) => {
            const lyricsIndices = sectionLyricsMap[sectionIndex] || []
            if (lyricsIndices.length === 0) {
              return (
                <div key={sectionIndex} className="flex items-start gap-3">
                  <span className="text-muted-foreground text-sm">
                    [{sectionIndex}] {section}:
                  </span>
                  <span className="text-muted-foreground text-sm italic">
                    가사 없음
                  </span>
                </div>
              )
            }
            return (
              <div key={sectionIndex} className="flex items-start gap-3">
                <span className="text-muted-foreground text-sm">
                  [{sectionIndex}] {section}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {lyricsIndices.map((lyricsIndex) => (
                    <Badge key={lyricsIndex} variant="secondary" className="text-sm">
                      페이지 {lyricsIndex + 1}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
