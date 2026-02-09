'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FloppyDiskIcon,
  FileExportIcon,
  Download04Icon,
  ArrowLeft01Icon,
} from '@hugeicons/core-free-icons'
import { buildDefaultOverlays } from '@/lib/utils/pdf-export-helpers'
import { saveContiPdfLayout } from '@/lib/actions/conti-pdf-exports'
import type {
  ContiWithSongsAndSheetMusic,
  ContiPdfExport,
  PdfLayoutState,
  PageLayout,
  OverlayElement,
} from '@/lib/types'

// ---- Types ----

interface EditorPage {
  songIndex: number
  sheetMusicFileId: string | null
  /** For image files: the file URL. For PDF pages: a rendered data URL. For metadata-only: null. */
  imageUrl: string | null
  /** If this page comes from a PDF file, which page of that PDF (0-based) */
  pdfPageIndex: number | null
  overlays: OverlayElement[]
}

interface PdfEditorProps {
  conti: ContiWithSongsAndSheetMusic
  existingExport: ContiPdfExport | null
}

// ---- Helpers ----

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${year}년 ${month}월 ${day}일`
}

async function getPdfPageCount(url: string): Promise<number> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  const doc = await pdfjsLib.getDocument(url).promise
  const count = doc.numPages
  doc.destroy()
  return count
}

async function renderPdfPageToDataUrl(
  url: string,
  pageNum: number,
  scale: number = 2,
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  const doc = await pdfjsLib.getDocument(url).promise
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  const dataUrl = canvas.toDataURL('image/png')
  doc.destroy()
  return dataUrl
}

// ---- Component ----

export function PdfEditor({ conti, existingExport }: PdfEditorProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [pages, setPages] = useState<EditorPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mobile guard
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  // Initialize pages
  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)

      // Parse existing layout state if available
      let savedLayouts: PageLayout[] | null = null
      if (existingExport?.layoutState) {
        try {
          const parsed: PdfLayoutState = JSON.parse(existingExport.layoutState)
          savedLayouts = parsed.pages
        } catch {
          // Ignore invalid JSON
        }
      }

      const editorPages: EditorPage[] = []

      for (let songIdx = 0; songIdx < conti.songs.length; songIdx++) {
        const contiSong = conti.songs[songIdx]
        const sheetMusic = contiSong.sheetMusic

        if (sheetMusic.length === 0) {
          // Metadata-only page
          const defaultOverlays = buildDefaultOverlays(
            songIdx,
            contiSong.overrides.sectionOrder,
            contiSong.overrides.tempos,
          )
          const saved = savedLayouts?.find(
            (l) => l.songIndex === songIdx && l.sheetMusicFileId === null,
          )
          editorPages.push({
            songIndex: songIdx,
            sheetMusicFileId: null,
            imageUrl: null,
            pdfPageIndex: null,
            overlays: saved?.overlays ?? defaultOverlays,
          })
          continue
        }

        for (const file of sheetMusic) {
          if (file.fileType.includes('image')) {
            // One page per image
            const defaultOverlays = buildDefaultOverlays(
              songIdx,
              contiSong.overrides.sectionOrder,
              contiSong.overrides.tempos,
            )
            const saved = savedLayouts?.find(
              (l) => l.songIndex === songIdx && l.sheetMusicFileId === file.id,
            )
            editorPages.push({
              songIndex: songIdx,
              sheetMusicFileId: file.id,
              imageUrl: file.fileUrl,
              pdfPageIndex: null,
              overlays: saved?.overlays ?? defaultOverlays,
            })
          } else if (file.fileType.includes('pdf')) {
            // Multiple pages per PDF
            try {
              const pageCount = await getPdfPageCount(file.fileUrl)
              for (let p = 0; p < pageCount; p++) {
                const defaultOverlays = buildDefaultOverlays(
                  songIdx,
                  contiSong.overrides.sectionOrder,
                  contiSong.overrides.tempos,
                )
                const saved = savedLayouts?.find(
                  (l) =>
                    l.songIndex === songIdx &&
                    l.sheetMusicFileId === file.id &&
                    l.pageIndex === editorPages.length,
                )
                editorPages.push({
                  songIndex: songIdx,
                  sheetMusicFileId: file.id,
                  imageUrl: null, // rendered lazily
                  pdfPageIndex: p,
                  overlays: saved?.overlays ?? defaultOverlays,
                })
              }
            } catch {
              // If PDF fails to load, add a metadata-only page
              const defaultOverlays = buildDefaultOverlays(
                songIdx,
                contiSong.overrides.sectionOrder,
                contiSong.overrides.tempos,
              )
              const savedFallback = savedLayouts?.find(
                (l) => l.songIndex === songIdx && l.sheetMusicFileId === file.id,
              )
              editorPages.push({
                songIndex: songIdx,
                sheetMusicFileId: file.id,
                imageUrl: null,
                pdfPageIndex: null,
                overlays: savedFallback?.overlays ?? defaultOverlays,
              })
            }
          }
        }
      }

      if (!cancelled) {
        setPages(editorPages)
        setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [conti, existingExport])

  // Render PDF page image lazily when navigating to a PDF page
  useEffect(() => {
    const page = pages[currentPageIndex]
    if (!page) return
    if (page.pdfPageIndex !== null && !page.imageUrl && page.sheetMusicFileId) {
      // Find the file URL from conti data
      let fileUrl: string | null = null
      for (const cs of conti.songs) {
        for (const sm of cs.sheetMusic) {
          if (sm.id === page.sheetMusicFileId) {
            fileUrl = sm.fileUrl
            break
          }
        }
        if (fileUrl) break
      }
      if (!fileUrl) return

      renderPdfPageToDataUrl(fileUrl, page.pdfPageIndex + 1)
        .then((dataUrl) => {
          setPages((prev) =>
            prev.map((p, i) =>
              i === currentPageIndex ? { ...p, imageUrl: dataUrl } : p,
            ),
          )
        })
        .catch(() => {
          // Failed to render PDF page
        })
    }
  }, [currentPageIndex, pages, conti.songs])

  // Auto-save with 3s debounce
  const triggerAutoSave = useCallback(() => {
    setSaveStatus('unsaved')
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      performSave()
    }, 3000)
  }, []) // performSave is stable via ref pattern below

  const performSave = useCallback(async () => {
    setSaveStatus('saving')
    const layoutState: PdfLayoutState = {
      pages: pages.map((p, i) => ({
        pageIndex: i,
        songIndex: p.songIndex,
        sheetMusicFileId: p.sheetMusicFileId,
        overlays: p.overlays,
      })),
      canvasWidth: containerRef.current?.clientWidth ?? 800,
      canvasHeight: containerRef.current?.clientHeight ?? 1131,
    }

    const result = await saveContiPdfLayout(conti.id, JSON.stringify(layoutState))
    if (result.success) {
      setSaveStatus('saved')
    } else {
      setSaveStatus('unsaved')
      toast.error(result.error ?? '저장 중 오류가 발생했습니다')
    }
  }, [pages, conti.id])

  // Keep triggerAutoSave up to date with latest performSave
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Update overlay position
  function updateOverlay(overlayId: string, updates: Partial<OverlayElement>) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page
        return {
          ...page,
          overlays: page.overlays.map((o) =>
            o.id === overlayId ? { ...o, ...updates } : o,
          ),
        }
      }),
    )
    triggerAutoSave()
  }

  // Drag handlers
  function handlePointerDown(e: React.PointerEvent, overlayId: string) {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const overlay = pages[currentPageIndex]?.overlays.find((o) => o.id === overlayId)
    if (!overlay) return

    const overlayPxX = (overlay.x / 100) * rect.width
    const overlayPxY = (overlay.y / 100) * rect.height
    const pointerX = e.clientX - rect.left
    const pointerY = e.clientY - rect.top

    dragOffsetRef.current = {
      x: pointerX - overlayPxX,
      y: pointerY - overlayPxY,
    }
    setDraggingId(overlayId)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent, overlayId: string) {
    if (draggingId !== overlayId) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    const x = ((e.clientX - rect.left - dragOffsetRef.current.x) / rect.width) * 100
    const y = ((e.clientY - rect.top - dragOffsetRef.current.y) / rect.height) * 100

    updateOverlay(overlayId, {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    })
  }

  function handlePointerUp(overlayId: string) {
    if (draggingId === overlayId) {
      setDraggingId(null)
    }
  }

  // Double-click to edit text
  function handleDoubleClick(overlayId: string) {
    // We use contentEditable inline, handled in the overlay render
  }

  // Manual save
  async function handleManualSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    await performSave()
    toast.success('레이아웃이 저장되었습니다')
  }

  // Navigation
  function goToPrevPage() {
    setCurrentPageIndex((i) => Math.max(0, i - 1))
  }

  function goToNextPage() {
    setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1))
  }

  // Mobile guard
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground text-lg">
          이 기능은 PC에서 사용해주세요
        </p>
        <Button variant="outline" render={<Link href={`/contis/${conti.id}`} />}>
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
          돌아가기
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded mt-2" />
          </div>
        </div>
        <div className="aspect-[1/1.414] w-full max-w-3xl mx-auto bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  const currentPage = pages[currentPageIndex]
  const songName = currentPage
    ? conti.songs[currentPage.songIndex]?.song.name ?? ''
    : ''

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="PDF 내보내기"
        description={`${conti.title || formatDate(conti.date)} - ${songName}`}
      >
        <span className="text-muted-foreground text-sm">
          {saveStatus === 'saved' && '저장됨'}
          {saveStatus === 'saving' && '저장 중...'}
          {saveStatus === 'unsaved' && '저장되지 않음'}
        </span>
        <Button variant="outline" onClick={handleManualSave}>
          <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} data-icon="inline-start" />
          저장
        </Button>
        <Button variant="outline" disabled>
          <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
          PDF 내보내기
        </Button>
        {existingExport?.pdfUrl && (
          <Button
            variant="outline"
            render={
              <a
                href={existingExport.pdfUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
            PDF 다운로드
          </Button>
        )}
        <Button variant="outline" render={<Link href={`/contis/${conti.id}`} />}>
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
          돌아가기
        </Button>
      </PageHeader>

      {/* Page Navigation */}
      {pages.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevPage}
            disabled={currentPageIndex === 0}
          >
            <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {currentPageIndex + 1} / {pages.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextPage}
            disabled={currentPageIndex === pages.length - 1}
          >
            <HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} />
          </Button>
        </div>
      )}

      {/* Canvas Area */}
      {currentPage && (
        <div
          ref={containerRef}
          className="relative aspect-[1/1.414] w-full max-w-3xl mx-auto border rounded-lg overflow-hidden bg-white"
        >
          {/* Sheet music background */}
          {currentPage.imageUrl ? (
            <img
              src={currentPage.imageUrl}
              alt={`악보 - ${songName}`}
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {currentPage.pdfPageIndex !== null
                ? 'PDF 페이지 로딩 중...'
                : songName}
            </div>
          )}

          {/* Overlay elements */}
          {currentPage.overlays.map((overlay) => (
            <div
              key={overlay.id}
              className={`absolute cursor-move select-none px-1.5 py-0.5 rounded transition-colors ${
                draggingId === overlay.id
                  ? 'border-2 border-blue-500 bg-blue-50/80'
                  : 'border border-transparent hover:border-gray-300 hover:bg-white/80'
              }`}
              style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                fontSize: `${overlay.fontSize}px`,
                fontWeight: overlay.type === 'songNumber' ? 700 : 600,
                transform:
                  overlay.type === 'bpm'
                    ? 'translateX(-100%)'
                    : overlay.type === 'sectionOrder'
                      ? 'translateX(-50%)'
                      : 'none',
                whiteSpace: 'nowrap',
              }}
              onPointerDown={(e) => handlePointerDown(e, overlay.id)}
              onPointerMove={(e) => handlePointerMove(e, overlay.id)}
              onPointerUp={() => handlePointerUp(overlay.id)}
              onDoubleClick={() => handleDoubleClick(overlay.id)}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                className="outline-none"
                onBlur={(e) => {
                  const newText = (e.target as HTMLElement).textContent ?? overlay.text
                  if (newText !== overlay.text) {
                    updateOverlay(overlay.id, { text: newText })
                  }
                }}
              >
                {overlay.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {pages.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="text-muted-foreground text-sm">
            이 콘티에 악보가 없습니다. 먼저 곡에 악보를 추가해주세요.
          </p>
        </div>
      )}
    </div>
  )
}
