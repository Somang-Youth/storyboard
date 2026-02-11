"use client"

import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { checkSpelling } from "@/lib/actions/spell-check"
import { computeWordDiff, getOriginalParts, getCorrectedParts, type DiffPart } from "@/lib/utils/text-diff"

interface SpellCheckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalText: string
  onAcceptCorrected: (correctedText: string) => void
}

export function SpellCheckDialog({
  open,
  onOpenChange,
  originalText,
  onAcceptCorrected,
}: SpellCheckDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [correctedText, setCorrectedText] = useState<string | null>(null)
  const [errorCount, setErrorCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !originalText.trim()) return

    setIsLoading(true)
    setError(null)
    setCorrectedText(null)

    checkSpelling(originalText).then((result) => {
      if (result.success && result.data) {
        setCorrectedText(result.data.corrected)
        setErrorCount(result.data.errorCount)
      } else {
        setError(result.error ?? "맞춤법 검사에 실패했습니다.")
      }
      setIsLoading(false)
    })
  }, [open, originalText])

  const hasCorrections = correctedText !== null && correctedText !== originalText

  const diffParts: DiffPart[] = hasCorrections
    ? computeWordDiff(originalText, correctedText)
    : []

  const originalParts = hasCorrections ? getOriginalParts(diffParts) : []
  const correctedParts = hasCorrections ? getCorrectedParts(diffParts) : []

  function renderParts(parts: DiffPart[], mode: "original" | "corrected") {
    return parts.map((part, i) => {
      if (part.removed && mode === "original") {
        return (
          <span key={i} className="bg-red-100 text-red-800 line-through rounded-sm px-0.5">
            {part.value}
          </span>
        )
      }
      if (part.added && mode === "corrected") {
        return (
          <span key={i} className="bg-green-100 text-green-800 rounded-sm px-0.5">
            {part.value}
          </span>
        )
      }
      return <span key={i}>{part.value}</span>
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>맞춤법 검사</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">검사 중...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && correctedText !== null && !hasCorrections && (
          <div className="text-center py-8">
            <p className="text-lg font-medium text-green-600">맞춤법 오류가 없습니다!</p>
            <p className="text-sm text-muted-foreground mt-1">입력한 텍스트에 오류가 없습니다.</p>
            <Button className="mt-4" onClick={() => onOpenChange(false)}>
              확인
            </Button>
          </div>
        )}

        {!isLoading && !error && hasCorrections && (
          <>
            <p className="text-sm text-muted-foreground">
              {errorCount}개의 교정 사항이 발견되었습니다. 사용할 텍스트를 선택하세요.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Original */}
              <button
                type="button"
                className="text-left rounded-lg border-2 border-transparent hover:border-muted-foreground/30 p-4 transition-colors bg-muted/30"
                onClick={() => onOpenChange(false)}
              >
                <div className="text-sm font-medium text-muted-foreground mb-2">원본</div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {renderParts(originalParts, "original")}
                </div>
              </button>

              {/* Corrected */}
              <button
                type="button"
                className="text-left rounded-lg border-2 border-primary/50 hover:border-primary p-4 transition-colors bg-primary/5"
                onClick={() => onAcceptCorrected(correctedText)}
              >
                <div className="text-sm font-medium text-primary mb-2">교정</div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {renderParts(correctedParts, "corrected")}
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                원본 유지
              </Button>
              <Button onClick={() => onAcceptCorrected(correctedText)}>
                교정 적용
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
