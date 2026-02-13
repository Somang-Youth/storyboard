"use client"

import { useState, useRef, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
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

  // Sync internal state when parent resets the map (e.g. lyrics page reorder)
  useEffect(() => {
    setSectionLyricsMap(initialMap)
  }, [initialMap])

  // Purge ghost page references when lyrics pages are added/removed
  useEffect(() => {
    setSectionLyricsMap(prev => {
      const next: Record<number, number[]> = {}
      let changed = false
      for (const [key, indices] of Object.entries(prev)) {
        const filtered = indices.filter(i => i < lyrics.length)
        if (filtered.length !== indices.length) changed = true
        if (filtered.length > 0) next[Number(key)] = filtered
        else { changed = true }
      }
      return changed ? next : prev
    })
  }, [lyrics.length])

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
      <div className="space-y-4">
        <h3 className="text-base font-medium">섹션-가사 매핑</h3>
        <p className="text-muted-foreground text-base">
          먼저 섹션 순서를 설정하세요
        </p>
      </div>
    )
  }

  if (lyrics.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-medium">섹션-가사 매핑</h3>
        <p className="text-muted-foreground text-base">
          먼저 가사 페이지를 추가하세요
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium">섹션-가사 매핑</h3>
      <Accordion multiple defaultValue={[]} className="gap-3">
        {sectionOrder.map((section, sectionIndex) => (
          <AccordionItem
            key={sectionIndex}
            value={String(sectionIndex)}
            className="ring-foreground/10 rounded-lg bg-muted/50 ring-1"
          >
            <AccordionTrigger className="w-full p-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-medium">
                  [{sectionIndex}]
                </span>
                <span className="text-base font-medium">{section}</span>
                <span className="text-muted-foreground text-sm font-normal">
                  ({(sectionLyricsMap[sectionIndex] || []).length}페이지)
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                {lyrics.map((lyric, lyricsIndex) => {
                  const isSelected =
                    sectionLyricsMap[sectionIndex]?.includes(lyricsIndex) || false
                  return (
                    <Tooltip key={lyricsIndex}>
                      <TooltipTrigger
                        render={
                          <label
                            className="flex cursor-pointer items-center gap-1.5"
                          />
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleLyricsForSection(sectionIndex, lyricsIndex)
                          }
                          className="size-4 cursor-pointer rounded"
                        />
                        <span className="text-base">페이지 {lyricsIndex + 1}</span>
                      </TooltipTrigger>
                      <TooltipContent className="whitespace-pre-wrap">
                        {lyric || "(빈 페이지)"}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Preview section — always visible, outside accordion */}
      <div>
        <div className="mb-2 text-base font-medium">미리보기</div>
        <div className="ring-foreground/10 space-y-2 rounded-lg bg-muted/30 p-3 ring-1">
          {sectionOrder.map((section, sectionIndex) => {
            const lyricsIndices = sectionLyricsMap[sectionIndex] || []
            if (lyricsIndices.length === 0) {
              return (
                <div key={sectionIndex} className="flex items-start gap-2">
                  <span className="text-muted-foreground text-sm shrink-0 whitespace-nowrap">
                    [{sectionIndex}] {section}:
                  </span>
                  <span className="text-muted-foreground text-sm italic">
                    가사 없음
                  </span>
                </div>
              )
            }
            return (
              <div key={sectionIndex} className="flex items-start gap-2">
                <span className="text-muted-foreground text-sm shrink-0 whitespace-nowrap">
                  [{sectionIndex}] {section}:
                </span>
                <div className="flex flex-wrap gap-1">
                  {lyricsIndices.map((lyricsIndex) => (
                    <Tooltip key={lyricsIndex}>
                      <TooltipTrigger render={<span />}>
                        <Badge variant="secondary" className="text-sm">
                          페이지 {lyricsIndex + 1}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="whitespace-pre-wrap">
                        {lyrics[lyricsIndex] || "(빈 페이지)"}
                      </TooltipContent>
                    </Tooltip>
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
