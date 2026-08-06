"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { AiMagicIcon, AlertCircleIcon, ArrowShrink01Icon, Cancel01Icon, Loading03Icon, RefreshIcon, TextCheckIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { generateLyricsFromSheetMusicImages } from "@/lib/actions/sheet-music-lyrics"
import { checkSpelling } from "@/lib/actions/spell-check"
import type { SheetMusicFile } from "@/lib/types"
import { computeWordDiff, getCorrectedParts, getOriginalParts } from "@/lib/utils/text-diff"
import { canMergeLyricsPages, mergeLyricsPages, validateLyricsPage } from "@/lib/utils/lyrics-validation"
import { buildSheetMusicLyricsImagePages } from "@/lib/utils/sheet-music-lyrics-images"

type GeneratorStatus = "idle" | "loading" | "ready" | "error"

interface SheetMusicLyricsGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sheetMusicFiles: SheetMusicFile[]
  songName?: string
  onGeneratedLyrics: (lyrics: string[]) => void
}

interface SpellCheckState {
  isLoading: boolean
  correctedText: string | null
  error: string | null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "가사 자동 생성 중 오류가 발생했습니다."
}

export function SheetMusicLyricsGeneratorDialog({
  open,
  onOpenChange,
  sheetMusicFiles,
  songName,
  onGeneratedLyrics,
}: SheetMusicLyricsGeneratorDialogProps) {
  const [status, setStatus] = useState<GeneratorStatus>("idle")
  const [loadingMessage, setLoadingMessage] = useState("악보 이미지를 준비하는 중...")
  const [error, setError] = useState<string | null>(null)
  const [preparedPageCount, setPreparedPageCount] = useState(0)
  const [generatedLyrics, setGeneratedLyrics] = useState<string[]>([])
  const [spellCheck, setSpellCheck] = useState<Record<number, SpellCheckState>>({})

  const prevOpenRef = useRef(false)
  const requestIdRef = useRef(0)

  const resetState = useCallback(() => {
    setStatus("idle")
    setLoadingMessage("악보 이미지를 준비하는 중...")
    setError(null)
    setPreparedPageCount(0)
    setGeneratedLyrics([])
    setSpellCheck({})
  }, [])

  const runGeneration = useCallback(async () => {
    const requestId = ++requestIdRef.current

    setStatus("loading")
    setLoadingMessage("악보 이미지를 준비하는 중...")
    setError(null)
    setPreparedPageCount(0)
    setGeneratedLyrics([])
    setSpellCheck({})

    try {
      const pages = await buildSheetMusicLyricsImagePages(sheetMusicFiles)
      if (requestId !== requestIdRef.current) return

      if (pages.length === 0) {
        throw new Error("가사를 생성할 악보 이미지가 없습니다.")
      }

      setPreparedPageCount(pages.length)
      setLoadingMessage("Gemini로 가사를 생성하는 중...")

      const result = await generateLyricsFromSheetMusicImages({
        songName,
        pages,
      })
      if (requestId !== requestIdRef.current) return

      if (!result.success || !result.data?.lyrics?.length) {
        throw new Error(result.error ?? "생성된 가사를 찾을 수 없습니다.")
      }

      setGeneratedLyrics(result.data.lyrics)
      setSpellCheck({})
      setStatus("ready")
    } catch (generationError) {
      if (requestId !== requestIdRef.current) return

      setError(getErrorMessage(generationError))
      setStatus("error")
    }
  }, [sheetMusicFiles, songName])

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open

    if (!open) {
      requestIdRef.current += 1
      resetState()
      return
    }

    if (!wasOpen) {
      void runGeneration()
    }
  }, [open, resetState, runGeneration])

  const updateGeneratedPage = (index: number, value: string) => {
    setGeneratedLyrics((current) => current.map((page, pageIndex) => (
      pageIndex === index ? value : page
    )))
    setSpellCheck((current) => {
      if (!current[index]) return current
      const next = { ...current }
      delete next[index]
      return next
    })
  }

  const removeGeneratedPage = (index: number) => {
    setGeneratedLyrics((current) => current.filter((_, pageIndex) => pageIndex !== index))
    setSpellCheck((current) => {
      const next: Record<number, SpellCheckState> = {}
      for (const [key, value] of Object.entries(current)) {
        const pageIndex = Number(key)
        if (pageIndex < index) next[pageIndex] = value
        else if (pageIndex > index) next[pageIndex - 1] = value
      }
      return next
    })
  }

  const mergeGeneratedPages = (index: number) => {
    setGeneratedLyrics((current) => {
      if (index < 0 || index + 1 >= current.length) return current
      const next = [...current]
      next.splice(index, 2, mergeLyricsPages(current[index], current[index + 1]))
      return next
    })
    setSpellCheck((current) => {
      const next: Record<number, SpellCheckState> = {}
      for (const [key, value] of Object.entries(current)) {
        const pageIndex = Number(key)
        if (pageIndex < index) next[pageIndex] = value
        else if (pageIndex === index || pageIndex === index + 1) continue
        else next[pageIndex - 1] = value
      }
      return next
    })
  }

  const handleSpellCheck = async (index: number) => {
    const text = generatedLyrics[index]
    if (!text?.trim()) return

    setSpellCheck((current) => ({
      ...current,
      [index]: { isLoading: true, correctedText: null, error: null },
    }))

    const result = await checkSpelling(text)

    if (result.success && result.data) {
      const corrected = result.data.corrected

      setSpellCheck((current) => ({
        ...current,
        [index]: {
          isLoading: false,
          correctedText: corrected === text ? null : corrected,
          error: null,
        },
      }))
      return
    }

    setSpellCheck((current) => ({
      ...current,
      [index]: {
        isLoading: false,
        correctedText: null,
        error: result.error ?? "맞춤법 검사에 실패했습니다.",
      },
    }))
  }

  const handleAcceptCorrection = (index: number, corrected: string) => {
    updateGeneratedPage(index, corrected)
  }

  const handleDismissSpellCheck = (index: number) => {
    setSpellCheck((current) => {
      const next = { ...current }
      delete next[index]
      return next
    })
  }

  const handleAddLyrics = () => {
    const pages = generatedLyrics.map((page) => page.trim()).filter(Boolean)
    if (pages.length === 0) return

    onGeneratedLyrics(pages)
    toast.success(`${pages.length}개 가사 페이지를 추가했습니다`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        overlayClassName="z-[70]"
        className="z-[70] flex max-h-[85vh] flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>가사 자동 생성</DialogTitle>
          <DialogDescription>
            현재 선택한 악보에서 가사 페이지만 생성해 아래 미리보기로 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {status === "loading" && (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{loadingMessage}</p>
                <p className="text-sm text-muted-foreground">
                  {preparedPageCount > 0
                    ? `${preparedPageCount}개 악보 페이지를 준비했습니다.`
                    : "악보 파일을 변환하고 있습니다."}
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2">
                <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="mt-0.5 size-5 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">가사 생성에 실패했습니다</p>
                  <p className="text-sm text-destructive/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          {status === "ready" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                악보 {preparedPageCount}페이지에서 가사 {generatedLyrics.length}페이지를 생성했습니다.
              </div>

              <div className="space-y-3">
                {generatedLyrics.map((page, index) => {
                  const sc = spellCheck[index]
                  const warnings = validateLyricsPage(page)
                  const correctedText = sc?.correctedText

                  return (
                    <Fragment key={index}>
                      <div className="space-y-1.5 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-4 text-primary" />
                            페이지 {index + 1}
                          </div>
                          <div className="flex gap-0.5">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={() => handleSpellCheck(index)}
                              aria-label="맞춤법 검사"
                              disabled={!page.trim() || sc?.isLoading}
                            >
                              {sc?.isLoading ? (
                                <>
                                  <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" data-icon="inline-start" />
                                  검사 중
                                </>
                              ) : (
                                <>
                                  <HugeiconsIcon icon={TextCheckIcon} strokeWidth={2} data-icon="inline-start" />
                                  맞춤법 검사
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => removeGeneratedPage(index)}
                              aria-label="페이지 제거"
                            >
                              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          rows={Math.min(6, Math.max(3, page.split("\n").length + 1))}
                          className="resize-none text-sm"
                          value={page}
                          onChange={(event) => updateGeneratedPage(index, event.target.value)}
                        />

                        {warnings.length > 0 && (
                          <div className="flex flex-col gap-0.5 px-1">
                            {warnings.map((warning) => (
                              <p key={warning.type} className="text-sm text-amber-600">
                                {warning.message}
                              </p>
                            ))}
                          </div>
                        )}

                        {sc?.error && (
                          <div className="px-1 text-sm text-destructive">{sc.error}</div>
                        )}

                        {sc && !sc.isLoading && !sc.error && sc.correctedText === null && (
                          <div className="px-1 text-sm text-green-600">맞춤법 오류가 없습니다!</div>
                        )}

                        {correctedText !== null && correctedText !== undefined && (
                          <div className="space-y-2 px-1">
                            <div className="text-sm text-muted-foreground">교정 결과를 선택하세요:</div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                className="rounded-lg border-2 border-transparent bg-muted/30 p-3 text-left transition-colors hover:border-muted-foreground/30"
                                onClick={() => handleDismissSpellCheck(index)}
                              >
                                <div className="mb-1 text-xs font-medium text-muted-foreground">원본 유지</div>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                  {getOriginalParts(computeWordDiff(page, correctedText)).map((part, partIndex) => (
                                    part.removed ? (
                                      <span key={partIndex} className="rounded-sm bg-red-100 px-0.5 text-red-800 line-through">
                                        {part.value}
                                      </span>
                                    ) : (
                                      <span key={partIndex}>{part.value}</span>
                                    )
                                  ))}
                                </div>
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3 text-left transition-colors hover:border-primary"
                                onClick={() => handleAcceptCorrection(index, correctedText)}
                              >
                                <div className="mb-1 text-xs font-medium text-primary">교정 적용</div>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                  {getCorrectedParts(computeWordDiff(page, correctedText)).map((part, partIndex) => (
                                    part.added ? (
                                      <span key={partIndex} className="rounded-sm bg-green-100 px-0.5 text-green-800">
                                        {part.value}
                                      </span>
                                    ) : (
                                      <span key={partIndex}>{part.value}</span>
                                    )
                                  ))}
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {index < generatedLyrics.length - 1 && (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => mergeGeneratedPages(index)}
                            disabled={!canMergeLyricsPages(generatedLyrics[index], generatedLyrics[index + 1])}
                            title={
                              canMergeLyricsPages(generatedLyrics[index], generatedLyrics[index + 1])
                                ? undefined
                                : "합치면 글자 수 제한을 초과합니다"
                            }
                            className="text-muted-foreground hover:text-foreground hover:border-foreground flex items-center gap-1 rounded-md border border-dashed px-3 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <HugeiconsIcon icon={ArrowShrink01Icon} strokeWidth={2} size={14} />
                            합치기
                          </button>
                        </div>
                      )}
                    </Fragment>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          {status === "error" && (
            <Button type="button" onClick={() => void runGeneration()}>
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
              다시 시도
            </Button>
          )}
          {status === "ready" && (
            <Button
              type="button"
              onClick={handleAddLyrics}
              disabled={!generatedLyrics.some((page) => page.trim())}
            >
              <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
              가사에 추가
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
