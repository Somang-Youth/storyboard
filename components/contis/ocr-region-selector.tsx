"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, Cancel01Icon, ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { extractTextFromRegions } from "@/lib/actions/ocr"
import { getPdfPageCount, renderPdfPagesToDataUrls } from "@/lib/utils/pdfjs"
import type { SheetMusicFile } from "@/lib/types"

interface Region {
  x: number
  y: number
  width: number
  height: number
}

interface OcrRegionSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sheetMusicFiles: SheetMusicFile[]
  onExtractedTexts: (texts: string[]) => void
}

interface DisplayPage {
  src: string
  label: string
  isDataUrl: boolean
}

function cropRegionToDataUrl(
  imageSrc: string,
  region: Region
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const sx = region.x * img.naturalWidth
      const sy = region.y * img.naturalHeight
      const sw = region.width * img.naturalWidth
      const sh = region.height * img.naturalHeight
      canvas.width = Math.max(1, Math.round(sw))
      canvas.height = Math.max(1, Math.round(sh))
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/png')
      const approxBytes = (dataUrl.length - 'data:image/png;base64,'.length) * 0.75
      if (approxBytes > 4 * 1024 * 1024) {
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      } else {
        resolve(dataUrl)
      }
    }
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'))
    img.src = imageSrc
  })
}

export function OcrRegionSelector({
  open,
  onOpenChange,
  sheetMusicFiles,
  onExtractedTexts,
}: OcrRegionSelectorProps) {
  const [pages, setPages] = useState<DisplayPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [pagesLoading, setPagesLoading] = useState(true)

  const [regions, setRegions] = useState<Region[]>([])
  const [drawingRegion, setDrawingRegion] = useState<Region | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null)

  // Build display pages from sheet music files (images + PDF pages)
  useEffect(() => {
    if (!open) return
    setPagesLoading(true)
    setPages([])
    setCurrentPageIndex(0)
    setRegions([])
    setDrawingRegion(null)
    setExtractedText(null)

    async function loadPages() {
      const result: DisplayPage[] = []
      for (const file of sheetMusicFiles) {
        if (file.fileType.startsWith('image/')) {
          result.push({ src: file.fileUrl, label: file.fileName, isDataUrl: false })
        } else if (file.fileType === 'application/pdf') {
          try {
            const pageCount = await getPdfPageCount(file.fileUrl)
            const pageNums = Array.from({ length: pageCount }, (_, i) => i + 1)
            const dataUrls = await renderPdfPagesToDataUrls(file.fileUrl, pageNums, 2)
            for (let i = 0; i < dataUrls.length; i++) {
              result.push({
                src: dataUrls[i],
                label: `${file.fileName} - ${i + 1}/${pageCount}페이지`,
                isDataUrl: true,
              })
            }
          } catch (err) {
            console.error('Failed to render PDF:', err)
          }
        }
      }
      setPages(result)
      setPagesLoading(false)
    }

    loadPages()
  }, [open, sheetMusicFiles])

  // Reset regions and aspect ratio when page changes
  useEffect(() => {
    setRegions([])
    setDrawingRegion(null)
    setExtractedText(null)
    setImageAspectRatio(null)
  }, [currentPageIndex])

  const getRelativePosition = useCallback((e: React.PointerEvent) => {
    const overlay = overlayRef.current
    if (!overlay) return { x: 0, y: 0 }
    const rect = overlay.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (extractedText !== null) return
    e.preventDefault()
    const pos = getRelativePosition(e)
    startPointRef.current = pos
    setDrawingRegion({ x: pos.x, y: pos.y, width: 0, height: 0 })
    setIsDrawing(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [extractedText, getRelativePosition])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !startPointRef.current) return
    const pos = getRelativePosition(e)
    const start = startPointRef.current
    setDrawingRegion({
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      width: Math.abs(pos.x - start.x),
      height: Math.abs(pos.y - start.y),
    })
  }, [isDrawing, getRelativePosition])

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !drawingRegion) return
    setIsDrawing(false)
    startPointRef.current = null
    // Only add if region has meaningful size (at least 1% in each dimension)
    if (drawingRegion.width > 0.01 && drawingRegion.height > 0.01) {
      setRegions(prev => [...prev, drawingRegion])
    }
    setDrawingRegion(null)
  }, [isDrawing, drawingRegion])

  const removeRegion = (index: number) => {
    setRegions(prev => prev.filter((_, i) => i !== index))
  }

  const resetRegions = () => {
    setRegions([])
    setExtractedText(null)
  }

  const handleExtract = async () => {
    if (regions.length === 0 || !pages[currentPageIndex]) return
    setIsExtracting(true)

    try {
      const currentPage = pages[currentPageIndex]
      const croppedDataUrls = await Promise.all(
        regions.map(region => cropRegionToDataUrl(currentPage.src, region))
      )

      const result = await extractTextFromRegions(
        croppedDataUrls.map(url => ({ imageDataUrl: url }))
      )

      if (result.success && result.data) {
        const cleaned = result.data.texts
          .map(t => t.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim())
          .filter(t => t !== '')
        setExtractedText(cleaned.join(' / '))
      } else {
        toast.error(result.error ?? 'OCR 추출에 실패했습니다.')
      }
    } catch (err) {
      toast.error('이미지 처리 중 오류가 발생했습니다.')
      console.error(err)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleAddToLyrics = () => {
    if (!extractedText || !extractedText.trim()) {
      toast.error('추출된 텍스트가 없습니다.')
      return
    }
    onExtractedTexts([extractedText.trim()])
    onOpenChange(false)
  }

  const currentPage = pages[currentPageIndex]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[92vh] flex flex-col"
        style={{
          maxWidth: imageAspectRatio
            ? `min(95vw, calc(92vh * ${imageAspectRatio} + 3rem))`
            : '64rem',
        }}
      >
        <DialogHeader>
          <DialogTitle>악보에서 가사 추출</DialogTitle>
        </DialogHeader>

        {pagesLoading && (
          <div className="flex items-center justify-center py-16">
            <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">악보 불러오는 중...</span>
          </div>
        )}

        {!pagesLoading && pages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            표시할 악보가 없습니다.
          </div>
        )}

        {!pagesLoading && pages.length > 0 && (
          <>
            {/* Page navigation */}
            {pages.length > 1 && (
              <div className="flex items-center justify-between px-1 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPageIndex === 0}
                  onClick={() => setCurrentPageIndex(prev => prev - 1)}
                >
                  <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} />
                  이전
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage?.label} ({currentPageIndex + 1}/{pages.length})
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPageIndex === pages.length - 1}
                  onClick={() => setCurrentPageIndex(prev => prev + 1)}
                >
                  다음
                  <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} />
                </Button>
              </div>
            )}

            {/* Image with region overlay */}
            <div className="relative flex-1 overflow-auto">
              <div className="relative inline-block w-full">
                {currentPage && (
                  <img
                    ref={imageRef}
                    src={currentPage.src}
                    crossOrigin="anonymous"
                    alt={currentPage.label}
                    className="w-full select-none"
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget
                      if (img.naturalWidth && img.naturalHeight) {
                        setImageAspectRatio(img.naturalWidth / img.naturalHeight)
                      }
                    }}
                  />
                )}

                {/* Overlay for drawing */}
                <div
                  ref={overlayRef}
                  className="absolute inset-0 cursor-crosshair"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* Completed regions */}
                  {regions.map((region, i) => (
                    <div
                      key={i}
                      className="absolute border-2 border-blue-500 bg-blue-500/15"
                      style={{
                        left: `${region.x * 100}%`,
                        top: `${region.y * 100}%`,
                        width: `${region.width * 100}%`,
                        height: `${region.height * 100}%`,
                      }}
                    >
                      <div className="absolute -top-3 -left-1 flex items-center gap-0.5">
                        <span className="bg-blue-500 text-white text-xs font-bold rounded-full size-5 flex items-center justify-center">
                          {i + 1}
                        </span>
                        {extractedText === null && (
                          <button
                            type="button"
                            className="bg-red-500 text-white rounded-full size-4 flex items-center justify-center hover:bg-red-600"
                            onClick={(e) => { e.stopPropagation(); removeRegion(i) }}
                          >
                            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={3} className="size-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Active drawing region */}
                  {drawingRegion && (
                    <div
                      className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10"
                      style={{
                        left: `${drawingRegion.x * 100}%`,
                        top: `${drawingRegion.y * 100}%`,
                        width: `${drawingRegion.width * 100}%`,
                        height: `${drawingRegion.height * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Extracted text preview (editable) */}
            {extractedText !== null && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium">추출된 텍스트 (수정 가능)</div>
                <textarea
                  className="w-full rounded border bg-background p-2 text-sm resize-none"
                  rows={3}
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                />
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                선택 영역: {regions.length}개
              </span>
              <div className="flex gap-2">
                {extractedText === null ? (
                  <>
                    <Button variant="outline" size="sm" onClick={resetRegions} disabled={regions.length === 0}>
                      영역 초기화
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExtract}
                      disabled={regions.length === 0 || isExtracting}
                    >
                      {isExtracting ? (
                        <>
                          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                          추출 중...
                        </>
                      ) : (
                        '가사 추출'
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={resetRegions}>
                      다시 선택
                    </Button>
                    <Button size="sm" onClick={handleAddToLyrics}>
                      가사에 추가
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
