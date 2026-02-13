"use client"

import { useState, useRef, useEffect, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon, TextCheckIcon, ScanImageIcon, Loading03Icon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { OcrRegionSelector } from "@/components/contis/ocr-region-selector"
import { checkSpelling } from "@/lib/actions/spell-check"
import { computeWordDiff, getOriginalParts, getCorrectedParts } from "@/lib/utils/text-diff"
import type { SheetMusicFile } from "@/lib/types"
import { validateLyricsPage } from "@/lib/utils/lyrics-validation"

interface LyricsEditorProps {
  initialLyrics: string[]
  onChange: (data: { lyrics: string[]; swappedPages?: [number, number]; insertedAt?: number }) => void
  sheetMusicFiles?: SheetMusicFile[]
}

interface SpellCheckState {
  isLoading: boolean
  correctedText: string | null
  error: string | null
}

export function LyricsEditor({
  initialLyrics,
  onChange,
  sheetMusicFiles,
}: LyricsEditorProps) {
  const [lyrics, setLyrics] = useState<string[]>(initialLyrics)
  const [ocrOpen, setOcrOpen] = useState(false)
  // Per-page spell check state, keyed by page index
  const [spellCheck, setSpellCheck] = useState<Record<number, SpellCheckState>>({})
  const pendingSwapRef = useRef<[number, number] | null>(null)
  const pendingInsertRef = useRef<number | null>(null)

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
    onChangeRef.current({
      lyrics,
      swappedPages: pendingSwapRef.current ?? undefined,
      insertedAt: pendingInsertRef.current ?? undefined,
    })
    pendingSwapRef.current = null
    pendingInsertRef.current = null
  }, [lyrics])

  const addPage = () => {
    setLyrics([...lyrics, ""])
  }

  const insertPage = (atIndex: number) => {
    const newLyrics = [...lyrics]
    newLyrics.splice(atIndex, 0, "")
    pendingInsertRef.current = atIndex
    setLyrics(newLyrics)
    setSpellCheck(prev => {
      const next: Record<number, SpellCheckState> = {}
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k)
        if (ki < atIndex) next[ki] = v
        else next[ki + 1] = v
      }
      return next
    })
  }

  const removePage = (index: number) => {
    setLyrics(lyrics.filter((_, i) => i !== index))
    // Clean up spell check state for removed page and shift indices
    setSpellCheck(prev => {
      const next: Record<number, SpellCheckState> = {}
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k)
        if (ki < index) next[ki] = v
        else if (ki > index) next[ki - 1] = v
      }
      return next
    })
  }

  const updatePage = (index: number, value: string) => {
    const newLyrics = [...lyrics]
    newLyrics[index] = value
    setLyrics(newLyrics)
    // Clear spell check when user edits text
    if (spellCheck[index]) {
      setSpellCheck(prev => {
        const next = { ...prev }
        delete next[index]
        return next
      })
    }
  }

  const movePage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= lyrics.length) return

    const newLyrics = [...lyrics]
    ;[newLyrics[index], newLyrics[targetIndex]] = [newLyrics[targetIndex], newLyrics[index]]
    pendingSwapRef.current = [index, targetIndex]
    setLyrics(newLyrics)

    setSpellCheck(prev => {
      const next = { ...prev }
      const a = prev[index]
      const b = prev[targetIndex]
      if (a) next[targetIndex] = a; else delete next[targetIndex]
      if (b) next[index] = b; else delete next[index]
      return next
    })
  }

  const handleSpellCheck = async (index: number) => {
    const text = lyrics[index]
    if (!text?.trim()) return

    setSpellCheck(prev => ({
      ...prev,
      [index]: { isLoading: true, correctedText: null, error: null },
    }))

    const result = await checkSpelling(text)

    if (result.success && result.data) {
      if (result.data.corrected === text) {
        // No corrections needed - briefly show then clear
        setSpellCheck(prev => ({
          ...prev,
          [index]: { isLoading: false, correctedText: null, error: null },
        }))
      } else {
        setSpellCheck(prev => ({
          ...prev,
          [index]: { isLoading: false, correctedText: result.data!.corrected, error: null },
        }))
      }
    } else {
      setSpellCheck(prev => ({
        ...prev,
        [index]: { isLoading: false, correctedText: null, error: result.error ?? '맞춤법 검사에 실패했습니다.' },
      }))
    }
  }

  const handleAcceptCorrection = (index: number, corrected: string) => {
    updatePage(index, corrected)
  }

  const handleDismissSpellCheck = (index: number) => {
    setSpellCheck(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const handleOcrExtractedTexts = (texts: string[]) => {
    setLyrics(prev => [...prev, ...texts])
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
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
        {lyrics.length > 0 && (
          <div className="-my-1 flex justify-center">
            <button
              type="button"
              onClick={() => insertPage(0)}
              className="text-muted-foreground hover:text-foreground hover:border-foreground flex items-center gap-1 rounded-md border border-dashed px-3 py-0.5 text-xs transition-colors"
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} size={14} />
              삽입
            </button>
          </div>
        )}
        {lyrics.map((lyric, index) => {
          const sc = spellCheck[index]
          const warnings = validateLyricsPage(lyric)
          return (
            <Fragment key={index}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-sm font-medium">
                  페이지 {index + 1}
                </label>
                <div className="flex gap-0.5">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => movePage(index, "up")}
                    disabled={index === 0}
                    aria-label="위로 이동"
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => movePage(index, "down")}
                    disabled={index === lyrics.length - 1}
                    aria-label="아래로 이동"
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleSpellCheck(index)}
                    aria-label="맞춤법 검사"
                    disabled={!lyric.trim() || sc?.isLoading}
                  >
                    {sc?.isLoading ? (
                      <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={TextCheckIcon} strokeWidth={2} />
                    )}
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

              {/* Lyrics validation warnings */}
              {warnings.length > 0 && (
                <div className="flex flex-col gap-0.5 px-1">
                  {warnings.map((w) => (
                    <p key={w.type} className="text-sm text-amber-600">
                      {w.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Inline spell check result */}
              {sc?.error && (
                <div className="text-sm text-destructive px-1">{sc.error}</div>
              )}

              {sc && !sc.isLoading && !sc.error && sc.correctedText === null && (
                <div className="text-sm text-green-600 px-1">맞춤법 오류가 없습니다!</div>
              )}

              {sc?.correctedText !== null && sc?.correctedText !== undefined && (
                <div className="space-y-2 px-1">
                  <div className="text-sm text-muted-foreground">교정 결과를 선택하세요:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="text-left rounded-lg border-2 border-transparent hover:border-muted-foreground/30 p-3 transition-colors bg-muted/30"
                      onClick={() => handleDismissSpellCheck(index)}
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-1">원본 유지</div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {getOriginalParts(computeWordDiff(lyric, sc.correctedText)).map((part, i) =>
                          part.removed ? (
                            <span key={i} className="bg-red-100 text-red-800 line-through rounded-sm px-0.5">{part.value}</span>
                          ) : (
                            <span key={i}>{part.value}</span>
                          )
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="text-left rounded-lg border-2 border-primary/50 hover:border-primary p-3 transition-colors bg-primary/5"
                      onClick={() => handleAcceptCorrection(index, sc.correctedText!)}
                    >
                      <div className="text-xs font-medium text-primary mb-1">교정 적용</div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {getCorrectedParts(computeWordDiff(lyric, sc.correctedText)).map((part, i) =>
                          part.added ? (
                            <span key={i} className="bg-green-100 text-green-800 rounded-sm px-0.5">{part.value}</span>
                          ) : (
                            <span key={i}>{part.value}</span>
                          )
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
            {index < lyrics.length - 1 && (
              <div className="-my-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => insertPage(index + 1)}
                  className="text-muted-foreground hover:text-foreground hover:border-foreground flex items-center gap-1 rounded-md border border-dashed px-3 py-0.5 text-xs transition-colors"
                >
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} size={14} />
                  삽입
                </button>
              </div>
            )}
            </Fragment>
          )
        })}
        {lyrics.length === 0 && (
          <p className="text-muted-foreground text-base">
            가사 페이지를 추가하세요
          </p>
        )}
      </div>

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
