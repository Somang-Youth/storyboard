"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon, TextCheckIcon, ScanImageIcon } from "@hugeicons/core-free-icons"
import { SpellCheckDialog } from "@/components/contis/spell-check-dialog"
import { OcrRegionSelector } from "@/components/contis/ocr-region-selector"
import type { SheetMusicFile } from "@/lib/types"
interface LyricsEditorProps {
  initialLyrics: string[]
  onChange: (data: { lyrics: string[] }) => void
  sheetMusicFiles?: SheetMusicFile[]
}

export function LyricsEditor({
  initialLyrics,
  onChange,
  sheetMusicFiles,
}: LyricsEditorProps) {
  const [lyrics, setLyrics] = useState<string[]>(initialLyrics)
  const [spellCheckOpen, setSpellCheckOpen] = useState(false)
  const [spellCheckPageIndex, setSpellCheckPageIndex] = useState(0)
  const [ocrOpen, setOcrOpen] = useState(false)

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
    onChangeRef.current({ lyrics })
  }, [lyrics])

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

  const handleSpellCheckAccept = (correctedText: string) => {
    updatePage(spellCheckPageIndex, correctedText)
    setSpellCheckOpen(false)
  }

  const handleOcrExtractedTexts = (texts: string[]) => {
    setLyrics(prev => [...prev, ...texts])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-medium">가사 페이지</div>
        <div className="flex gap-1.5">
          {sheetMusicFiles && sheetMusicFiles.length > 0 && (
            <Button size="xs" variant="outline" onClick={() => setOcrOpen(true)}>
              <HugeiconsIcon icon={ScanImageIcon} strokeWidth={2} />
              악보 OCR
            </Button>
          )}
          <Button size="xs" onClick={addPage}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            페이지 추가
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {lyrics.map((lyric, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-sm font-medium">
                페이지 {index + 1}
              </label>
              <div className="flex gap-0.5">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    setSpellCheckPageIndex(index)
                    setSpellCheckOpen(true)
                  }}
                  aria-label="맞춤법 검사"
                  disabled={!lyric.trim()}
                >
                  <HugeiconsIcon icon={TextCheckIcon} strokeWidth={2} />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => removePage(index)}
                  aria-label="삭제"
                >
                  <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                </Button>
              </div>
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

      <SpellCheckDialog
        open={spellCheckOpen}
        onOpenChange={setSpellCheckOpen}
        originalText={lyrics[spellCheckPageIndex] ?? ""}
        onAcceptCorrected={handleSpellCheckAccept}
      />

      {sheetMusicFiles && sheetMusicFiles.length > 0 && (
        <OcrRegionSelector
          open={ocrOpen}
          onOpenChange={setOcrOpen}
          sheetMusicFiles={sheetMusicFiles}
          onExtractedTexts={handleOcrExtractedTexts}
        />
      )}
    </div>
  )
}
