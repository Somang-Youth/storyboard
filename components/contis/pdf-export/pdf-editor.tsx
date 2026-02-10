'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { Button } from '@/components/ui/button'
import { useSidebarHeader } from '@/components/layout/sidebar-header-context'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FloppyDiskIcon,
  FileExportIcon,
  Download04Icon,
  ArrowLeft01Icon,
  CropIcon,
  TextFontIcon,
  Delete01Icon,
} from '@hugeicons/core-free-icons'
import { nanoid } from 'nanoid'
import { buildDefaultOverlays, generatePdfFilename } from '@/lib/utils/pdf-export-helpers'
import { getPdfPageCount, renderPdfPageToDataUrl } from '@/lib/utils/pdfjs'
import { saveContiPdfLayout, exportContiPdf } from '@/lib/actions/conti-pdf-exports'
import { saveSongPageImageFromForm, deletePageImagesForConti } from '@/lib/actions/song-page-images'
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
  imageScale: number
  imageOffsetX: number
  imageOffsetY: number
  cropX: number | null
  cropY: number | null
  cropWidth: number | null
  cropHeight: number | null
  originalImageUrl: string | null
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

// ---- Component ----

export function PdfEditor({ conti, existingExport }: PdfEditorProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [pages, setPages] = useState<EditorPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(existingExport?.pdfUrl ?? null)
  const [isPanningImage, setIsPanningImage] = useState(false)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [isCropMode, setIsCropMode] = useState(false)
  const [cropSelection, setCropSelection] = useState<{
    startX: number; startY: number; endX: number; endY: number
  } | null>(null)
  const [isCropDragging, setIsCropDragging] = useState(false)
  const [cropResizing, setCropResizing] = useState<'tl' | 'tr' | 'bl' | 'br' | 'top' | 'right' | 'bottom' | 'left' | null>(null)
  const [imageResizeHandle, setImageResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null)
  const [imageSelected, setImageSelected] = useState(false)

  const { setHeaderContent } = useSidebarHeader()

  const containerRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const panStartRef = useRef<{ x: number; y: number; offX: number; offY: number }>({ x: 0, y: 0, offX: 0, offY: 0 })
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const resizeStartRef = useRef<{
    x: number; y: number;
    scale: number; offX: number; offY: number;
    containerW: number; containerH: number;
    imgStartX: number; imgStartY: number; imgSizeX: number; imgSizeY: number;
  }>({ x: 0, y: 0, scale: 1, offX: 0, offY: 0, containerW: 0, containerH: 0, imgStartX: 0, imgStartY: 0, imgSizeX: 100, imgSizeY: 100 })
  const imgNaturalSizeRef = useRef<{ width: number; height: number } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const performSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const lastSaveRef = useRef<number>(Date.now())

  // Mobile guard
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  // Helper to apply saved crop coordinates to an image
  async function applySavedCrop(
    originalUrl: string,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
  ): Promise<string> {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image for crop'))
      img.src = originalUrl
    })

    const sx = Math.round(cropX * img.naturalWidth)
    const sy = Math.round(cropY * img.naturalHeight)
    const sw = Math.round(cropWidth * img.naturalWidth)
    const sh = Math.round(cropHeight * img.naturalHeight)

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    return canvas.toDataURL('image/png')
  }

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
            imageScale: saved?.imageScale ?? 1,
            imageOffsetX: saved?.imageOffsetX ?? 0,
            imageOffsetY: saved?.imageOffsetY ?? 0,
            cropX: saved?.cropX ?? null,
            cropY: saved?.cropY ?? null,
            cropWidth: saved?.cropWidth ?? null,
            cropHeight: saved?.cropHeight ?? null,
            originalImageUrl: saved?.originalImageUrl ?? null,
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
              imageScale: saved?.imageScale ?? 1,
              imageOffsetX: saved?.imageOffsetX ?? 0,
              imageOffsetY: saved?.imageOffsetY ?? 0,
              cropX: saved?.cropX ?? null,
              cropY: saved?.cropY ?? null,
              cropWidth: saved?.cropWidth ?? null,
              cropHeight: saved?.cropHeight ?? null,
              originalImageUrl: saved?.originalImageUrl ?? null,
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
                  imageScale: saved?.imageScale ?? 1,
                  imageOffsetX: saved?.imageOffsetX ?? 0,
                  imageOffsetY: saved?.imageOffsetY ?? 0,
                  cropX: saved?.cropX ?? null,
                  cropY: saved?.cropY ?? null,
                  cropWidth: saved?.cropWidth ?? null,
                  cropHeight: saved?.cropHeight ?? null,
                  originalImageUrl: saved?.originalImageUrl ?? null,
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
                imageScale: savedFallback?.imageScale ?? 1,
                imageOffsetX: savedFallback?.imageOffsetX ?? 0,
                imageOffsetY: savedFallback?.imageOffsetY ?? 0,
                cropX: savedFallback?.cropX ?? null,
                cropY: savedFallback?.cropY ?? null,
                cropWidth: savedFallback?.cropWidth ?? null,
                cropHeight: savedFallback?.cropHeight ?? null,
                originalImageUrl: savedFallback?.originalImageUrl ?? null,
              })
            }
          }
        }
      }

      // Re-apply saved crops for image files
      for (let idx = 0; idx < editorPages.length; idx++) {
        const ep = editorPages[idx]
        if (ep.cropX !== null && ep.cropY !== null && ep.cropWidth !== null && ep.cropHeight !== null && ep.originalImageUrl) {
          try {
            const croppedUrl = await applySavedCrop(
              ep.originalImageUrl, ep.cropX, ep.cropY, ep.cropWidth, ep.cropHeight,
            )
            editorPages[idx] = { ...ep, imageUrl: croppedUrl }
          } catch {
            editorPages[idx] = { ...ep, imageUrl: ep.originalImageUrl, originalImageUrl: null, cropX: null, cropY: null, cropWidth: null, cropHeight: null }
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
  // Only trigger on page navigation, not on every pages state change
  const renderingPageRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    setPages((prev) => {
      const page = prev[currentPageIndex]
      if (!page) return prev
      if (page.pdfPageIndex === null || page.imageUrl || !page.sheetMusicFileId) return prev
      if (renderingPageRef.current.has(currentPageIndex)) return prev
      renderingPageRef.current.add(currentPageIndex)

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
      if (!fileUrl) {
        renderingPageRef.current.delete(currentPageIndex)
        return prev
      }

      const pageIdx = currentPageIndex
      renderPdfPageToDataUrl(fileUrl, page.pdfPageIndex + 1)
        .then(async (dataUrl) => {
          let finalUrl = dataUrl
          if (page.cropX !== null && page.cropY !== null && page.cropWidth !== null && page.cropHeight !== null) {
            try {
              finalUrl = await applySavedCrop(dataUrl, page.cropX, page.cropY, page.cropWidth, page.cropHeight)
            } catch {
              // Fall back to uncropped
            }
          }
          setPages((p) =>
            p.map((pg, i) =>
              i === pageIdx && !pg.imageUrl
                ? { ...pg, imageUrl: finalUrl, originalImageUrl: page.cropX !== null ? dataUrl : null }
                : pg,
            ),
          )
        })
        .catch((err) => {
          console.error('[PDF Editor] Failed to render PDF page:', err)
        })
        .finally(() => {
          renderingPageRef.current.delete(pageIdx)
        })

      return prev
    })
  }, [currentPageIndex, conti.songs, loading])

  // Auto-save with 3s debounce and 30s max interval
  const performSave = useCallback(async () => {
    setSaveStatus('saving')
    const layoutState: PdfLayoutState = {
      pages: pages.map((p, i) => ({
        pageIndex: i,
        songIndex: p.songIndex,
        sheetMusicFileId: p.sheetMusicFileId,
        overlays: p.overlays,
        imageScale: p.imageScale !== 1 ? p.imageScale : undefined,
        imageOffsetX: p.imageOffsetX !== 0 ? p.imageOffsetX : undefined,
        imageOffsetY: p.imageOffsetY !== 0 ? p.imageOffsetY : undefined,
        cropX: p.cropX ?? undefined,
        cropY: p.cropY ?? undefined,
        cropWidth: p.cropWidth ?? undefined,
        cropHeight: p.cropHeight ?? undefined,
        originalImageUrl: (p.originalImageUrl && !p.originalImageUrl.startsWith('data:')) ? p.originalImageUrl : undefined,
      })),
      canvasWidth: containerRef.current?.clientWidth ?? 800,
      canvasHeight: containerRef.current?.clientHeight ?? 1131,
    }

    const result = await saveContiPdfLayout(conti.id, JSON.stringify(layoutState))
    if (result.success) {
      setSaveStatus('saved')
      lastSaveRef.current = Date.now()
    } else {
      setSaveStatus('unsaved')
      toast.error(result.error ?? '저장 중 오류가 발생했습니다')
    }
  }, [pages, conti.id])

  // Keep ref in sync so triggerAutoSave always calls latest performSave
  useEffect(() => {
    performSaveRef.current = performSave
  }, [performSave])

  const triggerAutoSave = useCallback(() => {
    setSaveStatus('unsaved')
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    // Force save if 30s elapsed since last save (continuous editing)
    if (Date.now() - lastSaveRef.current > 30000) {
      performSaveRef.current()
      return
    }
    saveTimerRef.current = setTimeout(() => {
      performSaveRef.current()
    }, 3000)
  }, [])

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === 'unsaved') {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveStatus])

  // Inject custom sidebar header
  useEffect(() => {
    setHeaderContent(
      <div className="flex items-start gap-2">
        <Link
          href={`/contis/${conti.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-6 mt-0.5" />
        </Link>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">PDF 내보내기</h2>
          <p className="text-sm text-muted-foreground truncate">
            {conti.title || formatDate(conti.date)}
          </p>
        </div>
      </div>
    )
    return () => setHeaderContent(null)
  }, [conti.id, conti.title, conti.date, setHeaderContent])

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

  // Update image transform
  function updateImageTransform(updates: Partial<{ imageScale: number; imageOffsetX: number; imageOffsetY: number }>) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page
        return { ...page, ...updates }
      }),
    )
    triggerAutoSave()
  }

  // Update image transform without triggering auto-save (for continuous drag/slider)
  function updateImageTransformSilent(updates: Partial<{ imageScale: number; imageOffsetX: number; imageOffsetY: number }>) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page
        return { ...page, ...updates }
      }),
    )
  }

  // Compute the visual image position within the container (% of container), accounting for object-fit: contain
  function getContainBounds(): { startX: number; startY: number; sizeX: number; sizeY: number } {
    const container = containerRef.current
    const nat = imgNaturalSizeRef.current
    if (!container || !nat || nat.width === 0 || nat.height === 0) {
      return { startX: 0, startY: 0, sizeX: 100, sizeY: 100 }
    }
    const cW = container.clientWidth
    const cH = container.clientHeight
    const imgAspect = nat.width / nat.height
    const containerAspect = cW / cH
    if (imgAspect > containerAspect) {
      const sizeYPct = (cW / imgAspect / cH) * 100
      return { startX: 0, startY: (100 - sizeYPct) / 2, sizeX: 100, sizeY: sizeYPct }
    } else {
      const sizeXPct = (cH * imgAspect / cW) * 100
      return { startX: (100 - sizeXPct) / 2, startY: 0, sizeX: sizeXPct, sizeY: 100 }
    }
  }

  // Helper function to get image visual bounds as % of container
  function getImageBounds(page: EditorPage) {
    const s = page.imageScale
    const offX = page.imageOffsetX
    const offY = page.imageOffsetY
    const c = getContainBounds()
    return {
      left: s * c.startX + offX,
      top: s * c.startY + offY,
      right: s * (c.startX + c.sizeX) + offX,
      bottom: s * (c.startY + c.sizeY) + offY,
    }
  }

  // Container-level pointer handlers for image panning
  function handleContainerPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    // Clear selection on background click (not overlay, not toolbar)
    if (!target.closest('[data-overlay]') && !target.closest('[data-toolbar]')) {
      setSelectedOverlayId(null)
      // Toggle image selection
      const currentPg = pages[currentPageIndex]
      if (currentPg?.imageUrl && !isCropMode) {
        setImageSelected((prev) => !prev)
      }
    } else {
      // Deselect image when clicking overlay or toolbar
      setImageSelected(false)
    }

    // Only pan if clicking on the image/background area, not on an overlay
    if (target.closest('[data-overlay]') || target.closest('[data-toolbar]')) return

    if (isCropMode) return

    const currentPg = pages[currentPageIndex]
    if (!currentPg) return

    e.preventDefault()
    setIsPanningImage(true)
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offX: currentPg.imageOffsetX,
      offY: currentPg.imageOffsetY,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleContainerPointerMove(e: React.PointerEvent) {
    if (imageResizeHandle) return
    if (!isPanningImage) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    const currentPg = pages[currentPageIndex]
    if (!currentPg) return

    const deltaXPct = ((e.clientX - panStartRef.current.x) / rect.width) * 100
    const deltaYPct = ((e.clientY - panStartRef.current.y) / rect.height) * 100

    const newOffX = panStartRef.current.offX + deltaXPct
    const newOffY = panStartRef.current.offY + deltaYPct

    updateImageTransformSilent({ imageOffsetX: newOffX, imageOffsetY: newOffY })
  }

  function handleContainerPointerUp() {
    if (isPanningImage) {
      setIsPanningImage(false)
      triggerAutoSave()
    }
  }

  // Corner handle resize handlers
  function handleImageResizeDown(e: React.PointerEvent, corner: 'tl' | 'tr' | 'bl' | 'br') {
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const currentPg = pages[currentPageIndex]
    if (!currentPg) return

    const rect = container.getBoundingClientRect()
    const c = getContainBounds()
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scale: currentPg.imageScale,
      offX: currentPg.imageOffsetX,
      offY: currentPg.imageOffsetY,
      containerW: rect.width,
      containerH: rect.height,
      imgStartX: c.startX,
      imgStartY: c.startY,
      imgSizeX: c.sizeX,
      imgSizeY: c.sizeY,
    }
    setImageResizeHandle(corner)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleImageResizeMove(e: React.PointerEvent) {
    if (!imageResizeHandle) return
    const { scale: startScale, offX: startOffX, offY: startOffY, imgStartX, imgStartY, imgSizeX, imgSizeY } = resizeStartRef.current
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    const ptrXPct = ((e.clientX - rect.left) / rect.width) * 100
    const ptrYPct = ((e.clientY - rect.top) / rect.height) * 100

    // Determine anchor corner (opposite of dragged corner) using visual image bounds
    let anchorXPct: number, anchorYPct: number
    const imgEndX = imgStartX + imgSizeX
    const imgEndY = imgStartY + imgSizeY
    if (imageResizeHandle === 'br') {
      anchorXPct = startScale * imgStartX + startOffX
      anchorYPct = startScale * imgStartY + startOffY
    } else if (imageResizeHandle === 'tl') {
      anchorXPct = startScale * imgEndX + startOffX
      anchorYPct = startScale * imgEndY + startOffY
    } else if (imageResizeHandle === 'tr') {
      anchorXPct = startScale * imgStartX + startOffX
      anchorYPct = startScale * imgEndY + startOffY
    } else {
      // bl
      anchorXPct = startScale * imgEndX + startOffX
      anchorYPct = startScale * imgStartY + startOffY
    }

    // Distance from anchor to current pointer, normalized by visual image size
    const currDistX = Math.abs(ptrXPct - anchorXPct)
    const currDistY = Math.abs(ptrYPct - anchorYPct)
    const initDistX = startScale * imgSizeX
    const initDistY = startScale * imgSizeY
    const ratioX = initDistX > 0 ? currDistX / initDistX : 0
    const ratioY = initDistY > 0 ? currDistY / initDistY : 0
    const maxRatio = Math.max(ratioX, ratioY)
    if (maxRatio < 0.01) return

    const newScale = Math.max(0.3, Math.min(3.0, maxRatio * startScale))

    // Compute offset so anchor corner stays fixed
    let newOffX: number, newOffY: number
    if (imageResizeHandle === 'br') {
      newOffX = startOffX + (startScale - newScale) * imgStartX
      newOffY = startOffY + (startScale - newScale) * imgStartY
    } else if (imageResizeHandle === 'tl') {
      newOffX = startOffX + (startScale - newScale) * imgEndX
      newOffY = startOffY + (startScale - newScale) * imgEndY
    } else if (imageResizeHandle === 'tr') {
      newOffX = startOffX + (startScale - newScale) * imgStartX
      newOffY = startOffY + (startScale - newScale) * imgEndY
    } else {
      // bl
      newOffX = startOffX + (startScale - newScale) * imgEndX
      newOffY = startOffY + (startScale - newScale) * imgStartY
    }

    updateImageTransformSilent({ imageScale: newScale, imageOffsetX: newOffX, imageOffsetY: newOffY })
  }

  function handleImageResizeUp() {
    if (imageResizeHandle) {
      setImageResizeHandle(null)
      triggerAutoSave()
    }
  }

  // Crop mode handlers
  function handleCropPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setCropSelection({ startX: x, startY: y, endX: x, endY: y })
    setIsCropDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleCropPointerMove(e: React.PointerEvent) {
    if (!isCropDragging) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

    setCropSelection((prev) => prev ? { ...prev, endX: x, endY: y } : null)
  }

  function handleCropPointerUp() {
    setIsCropDragging(false)
    if (cropSelection) {
      const w = Math.abs(cropSelection.endX - cropSelection.startX)
      const h = Math.abs(cropSelection.endY - cropSelection.startY)
      if (w < 2 || h < 2) {
        setCropSelection(null)
      }
    }
  }

  function handleCropCancel() {
    setCropSelection(null)
  }

  function handleResizePointerDown(e: React.PointerEvent, handle: 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'right' | 'bottom' | 'left') {
    e.preventDefault()
    e.stopPropagation()
    setCropResizing(handle)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleResizePointerMove(e: React.PointerEvent) {
    if (!cropResizing || !cropSelection) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

    const left = Math.min(cropSelection.startX, cropSelection.endX)
    const top = Math.min(cropSelection.startY, cropSelection.endY)
    const right = Math.max(cropSelection.startX, cropSelection.endX)
    const bottom = Math.max(cropSelection.startY, cropSelection.endY)

    let newLeft = left, newTop = top, newRight = right, newBottom = bottom

    // Corner handles
    if (cropResizing === 'tl') { newLeft = Math.min(x, right - 2); newTop = Math.min(y, bottom - 2) }
    else if (cropResizing === 'tr') { newRight = Math.max(x, left + 2); newTop = Math.min(y, bottom - 2) }
    else if (cropResizing === 'bl') { newLeft = Math.min(x, right - 2); newBottom = Math.max(y, top + 2) }
    else if (cropResizing === 'br') { newRight = Math.max(x, left + 2); newBottom = Math.max(y, top + 2) }
    // Edge handles
    else if (cropResizing === 'top') { newTop = Math.min(y, bottom - 2) }
    else if (cropResizing === 'bottom') { newBottom = Math.max(y, top + 2) }
    else if (cropResizing === 'left') { newLeft = Math.min(x, right - 2) }
    else if (cropResizing === 'right') { newRight = Math.max(x, left + 2) }

    setCropSelection({ startX: newLeft, startY: newTop, endX: newRight, endY: newBottom })
  }

  function handleResizePointerUp() {
    setCropResizing(null)
  }

  async function handleCropConfirm() {
    if (!cropSelection || !currentPage?.imageUrl) return

    const container = containerRef.current
    if (!container) return

    const selLeft = Math.min(cropSelection.startX, cropSelection.endX) / 100
    const selTop = Math.min(cropSelection.startY, cropSelection.endY) / 100
    const selWidth = Math.abs(cropSelection.endX - cropSelection.startX) / 100
    const selHeight = Math.abs(cropSelection.endY - cropSelection.startY) / 100

    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = currentPage.imageUrl!
    })

    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight

    const containerW = container.clientWidth
    const containerH = container.clientHeight

    const imageAspect = naturalW / naturalH
    const containerAspect = containerW / containerH

    let renderedW: number, renderedH: number, renderedX: number, renderedY: number

    if (imageAspect > containerAspect) {
      renderedW = containerW
      renderedH = containerW / imageAspect
      renderedX = 0
      renderedY = (containerH - renderedH) / 2
    } else {
      renderedH = containerH
      renderedW = containerH * imageAspect
      renderedX = (containerW - renderedW) / 2
      renderedY = 0
    }

    const scale = currentPage.imageScale
    const offXPx = (currentPage.imageOffsetX / 100) * containerW
    const offYPx = (currentPage.imageOffsetY / 100) * containerH

    const actualX = renderedX * scale + offXPx
    const actualY = renderedY * scale + offYPx
    const actualW = renderedW * scale
    const actualH = renderedH * scale

    const selLeftPx = selLeft * containerW
    const selTopPx = selTop * containerH
    const selWidthPx = selWidth * containerW
    const selHeightPx = selHeight * containerH

    const cropNatX = ((selLeftPx - actualX) / actualW) * naturalW
    const cropNatY = ((selTopPx - actualY) / actualH) * naturalH
    const cropNatW = (selWidthPx / actualW) * naturalW
    const cropNatH = (selHeightPx / actualH) * naturalH

    const sx = Math.max(0, Math.round(cropNatX))
    const sy = Math.max(0, Math.round(cropNatY))
    const sw = Math.min(naturalW - sx, Math.round(cropNatW))
    const sh = Math.min(naturalH - sy, Math.round(cropNatH))

    if (sw <= 0 || sh <= 0) {
      toast.error('선택 영역이 이미지 범위를 벗어났습니다')
      setCropSelection(null)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

    const croppedDataUrl = canvas.toDataURL('image/png')

    // Compute normalized crop coordinates relative to the ORIGINAL image
    let normCropX: number, normCropY: number, normCropW: number, normCropH: number

    if (currentPage.cropX !== null && currentPage.cropY !== null &&
        currentPage.cropWidth !== null && currentPage.cropHeight !== null) {
      // Re-crop: compose with existing crop coordinates
      normCropX = currentPage.cropX + (sx / naturalW) * currentPage.cropWidth
      normCropY = currentPage.cropY + (sy / naturalH) * currentPage.cropHeight
      normCropW = (sw / naturalW) * currentPage.cropWidth
      normCropH = (sh / naturalH) * currentPage.cropHeight
    } else {
      normCropX = sx / naturalW
      normCropY = sy / naturalH
      normCropW = sw / naturalW
      normCropH = sh / naturalH
    }

    const originalUrl = currentPage.originalImageUrl ?? currentPage.imageUrl

    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page
        return {
          ...page,
          imageUrl: croppedDataUrl,
          originalImageUrl: originalUrl,
          imageScale: 1,
          imageOffsetX: 0,
          imageOffsetY: 0,
          cropX: normCropX,
          cropY: normCropY,
          cropWidth: normCropW,
          cropHeight: normCropH,
        }
      }),
    )

    setIsCropMode(false)
    setCropSelection(null)
    triggerAutoSave()
  }

  function handleUndoCrop() {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page
        return {
          ...page,
          imageUrl: page.originalImageUrl,
          originalImageUrl: null,
          imageScale: 1,
          imageOffsetX: 0,
          imageOffsetY: 0,
          cropX: null,
          cropY: null,
          cropWidth: null,
          cropHeight: null,
        }
      }),
    )
    setIsCropMode(false)
    setCropSelection(null)
    triggerAutoSave()
  }

  function handleCancelCropMode() {
    setIsCropMode(false)
    setCropSelection(null)
    setIsCropDragging(false)
  }

  // Drag handlers
  function handlePointerDown(e: React.PointerEvent, overlayId: string) {
    e.stopPropagation()

    // Allow contentEditable text editing
    if ((e.target as HTMLElement).isContentEditable) return

    e.preventDefault()
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
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

  function handlePointerUp(e: React.PointerEvent, overlayId: string) {
    if (draggingId === overlayId) {
      setDraggingId(null)
      // If movement < 5px, treat as click (select overlay)
      const dx = e.clientX - pointerStartRef.current.x
      const dy = e.clientY - pointerStartRef.current.y
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        setSelectedOverlayId(overlayId)
      }
    }
  }

  // Double-click to edit text
  function handleDoubleClick() {
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

  // PDF Export handler
  async function handleExport() {
    setExporting(true)
    try {
      // Save current layout first
      await performSave()

      // Use container dimensions so overlay font sizes match preview exactly
      const canvasWidth = containerRef.current?.clientWidth ?? 768
      const canvasHeight = containerRef.current?.clientHeight ?? Math.round(768 * 1.414)

      // Generate meaningful filename
      const songNames = conti.songs.map(cs => cs.song.name)
      const pdfFilename = generatePdfFilename(conti.title, conti.date, songNames)

      // Ensure Pretendard font is loaded before export
      try {
        await document.fonts.load('16px "Pretendard Variable"')
      } catch {
        await document.fonts.load('16px Pretendard').catch(() => {})
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = 595.28
      const pageHeight = 841.89

      const pageUploads: {
        dataUrl: string
        songId: string
        pageIndex: number
        sheetMusicFileId: string | null
        pdfPageIndex: number | null
        presetSnapshot: string
      }[] = []

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage()

        // Create a temporary render container
        const renderDiv = document.createElement('div')
        renderDiv.style.width = `${canvasWidth}px`
        renderDiv.style.height = `${canvasHeight}px`
        renderDiv.style.position = 'fixed'
        renderDiv.style.left = '-9999px'
        renderDiv.style.top = '-9999px'
        renderDiv.style.background = 'white'
        renderDiv.style.overflow = 'hidden'
        document.body.appendChild(renderDiv)

        let page = pages[i]

        // If this is a PDF page that hasn't been rendered yet, render it now
        if (page.imageUrl === null && page.pdfPageIndex !== null && page.sheetMusicFileId) {
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
          if (fileUrl) {
            try {
              const renderedUrl = await renderPdfPageToDataUrl(fileUrl, page.pdfPageIndex + 1)
              if (page.cropX !== null && page.cropY !== null && page.cropWidth !== null && page.cropHeight !== null) {
                page = { ...page, imageUrl: await applySavedCrop(renderedUrl, page.cropX, page.cropY, page.cropWidth, page.cropHeight) }
              } else {
                page = { ...page, imageUrl: renderedUrl }
              }
            } catch (err) {
              console.error(`[PDF Export] Failed to render PDF page ${page.pdfPageIndex} for file ${page.sheetMusicFileId}:`, err)
            }
          }
        }

        // Render sheet music image
        if (page.imageUrl) {
          const scale = page.imageScale ?? 1
          const offX = page.imageOffsetX ?? 0
          const offY = page.imageOffsetY ?? 0

          // Load the source image
          const srcImg = new Image()
          srcImg.crossOrigin = 'anonymous'
          srcImg.src = page.imageUrl
          await new Promise<void>((resolve, reject) => {
            if (srcImg.complete && srcImg.naturalWidth > 0) { resolve(); return }
            srcImg.onload = () => resolve()
            srcImg.onerror = () => reject(new Error('Image load failed'))
          })

          // Calculate "contain" dimensions within canvasWidth x canvasHeight
          const imgAspect = srcImg.naturalWidth / srcImg.naturalHeight
          const pageAspect = canvasWidth / canvasHeight
          let drawWidth: number, drawHeight: number, drawX: number, drawY: number
          if (imgAspect > pageAspect) {
            drawWidth = canvasWidth
            drawHeight = canvasWidth / imgAspect
            drawX = 0
            drawY = (canvasHeight - drawHeight) / 2
          } else {
            drawHeight = canvasHeight
            drawWidth = canvasHeight * imgAspect
            drawX = (canvasWidth - drawWidth) / 2
            drawY = 0
          }

          // Apply scale and offset
          // CSS transform: scale(S) translate(offX/S%, offY/S%)
          // Resolves to: visualPos = S * containPos + (off/100) * containerSize
          const scaledWidth = drawWidth * scale
          const scaledHeight = drawHeight * scale
          const finalX = drawX * scale + (offX / 100) * canvasWidth
          const finalY = drawY * scale + (offY / 100) * canvasHeight

          // Pre-render to a canvas at 2x for quality
          const preCanvas = document.createElement('canvas')
          preCanvas.width = canvasWidth * 2
          preCanvas.height = canvasHeight * 2
          const preCtx = preCanvas.getContext('2d')!
          preCtx.scale(2, 2)
          preCtx.drawImage(srcImg, finalX, finalY, scaledWidth, scaledHeight)

          // Insert as a flat image into the render div
          const flatImg = document.createElement('img')
          flatImg.src = preCanvas.toDataURL('image/png')
          flatImg.style.position = 'absolute'
          flatImg.style.top = '0'
          flatImg.style.left = '0'
          flatImg.style.width = `${canvasWidth}px`
          flatImg.style.height = `${canvasHeight}px`
          renderDiv.appendChild(flatImg)

          // Wait for the flat image to load
          await new Promise<void>((resolve) => {
            if (flatImg.complete) { resolve(); return }
            flatImg.onload = () => resolve()
            flatImg.onerror = () => resolve()
          })
        } else {
          // Metadata-only page or unrendered PDF page
          const songName = conti.songs[page.songIndex]?.song.name ?? ''
          const placeholder = document.createElement('div')
          placeholder.style.position = 'absolute'
          placeholder.style.inset = '0'
          placeholder.style.display = 'flex'
          placeholder.style.alignItems = 'center'
          placeholder.style.justifyContent = 'center'
          placeholder.style.color = '#888'
          placeholder.style.fontSize = '18px'
          placeholder.textContent = songName
          placeholder.style.fontFamily = '"Pretendard Variable", Pretendard, -apple-system, sans-serif'
          renderDiv.appendChild(placeholder)
        }

        // Render overlays
        for (const overlay of page.overlays) {
          const el = document.createElement('div')
          el.style.position = 'absolute'
          el.style.left = `${overlay.x}%`
          el.style.top = `${overlay.y}%`
          el.style.fontSize = `${overlay.fontSize}px`
          el.style.fontWeight = overlay.type === 'songNumber' ? '700' : overlay.type === 'custom' ? '400' : '600'
          el.style.whiteSpace = 'nowrap'
          el.style.transform =
            overlay.type === 'bpm'
              ? 'translateX(-100%)'
              : overlay.type === 'sectionOrder'
                ? 'translateX(-50%)'
                : 'none'
          el.textContent = overlay.text
          el.style.color = overlay.color ?? '#000000'
          el.style.fontFamily = '"Pretendard Variable", Pretendard, -apple-system, sans-serif'
          renderDiv.appendChild(el)
        }

        // Capture to canvas
        const canvas = await html2canvas(renderDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          width: canvasWidth,
          height: canvasHeight,
          onclone: (clonedDoc) => {
            // Remove stylesheets so html2canvas doesn't try to parse
            // Tailwind CSS v4's lab()/oklch() color functions it can't handle.
            // Our render div uses only inline styles, so this is safe.
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => el.remove())
          },
        })

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

        // Collect page data for per-song image storage
        const contiSong = conti.songs[page.songIndex]
        if (contiSong) {
          pageUploads.push({
            dataUrl,
            songId: contiSong.songId,
            pageIndex: i,
            sheetMusicFileId: page.sheetMusicFileId,
            pdfPageIndex: page.pdfPageIndex ?? null,
            presetSnapshot: JSON.stringify({
              keys: contiSong.overrides.keys,
              tempos: contiSong.overrides.tempos,
              sectionOrder: contiSong.overrides.sectionOrder,
              lyrics: contiSong.overrides.lyrics,
              sectionLyricsMap: contiSong.overrides.sectionLyricsMap,
              notes: contiSong.overrides.notes ?? null,
            }),
          })
        }

        doc.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight)

        // Clean up
        document.body.removeChild(renderDiv)
      }

      // Generate blob and upload
      const pdfBlob = doc.output('blob')
      const formData = new FormData()
      formData.append('file', pdfBlob, pdfFilename)

      const result = await exportContiPdf(conti.id, formData)
      if (result.success && result.data) {
        toast.success('PDF가 생성되어 다운로드됩니다')
        setPdfUrl(result.data.pdfUrl)

        // Auto-download using local blob URL for guaranteed filename
        const blobUrl = URL.createObjectURL(pdfBlob)
        const downloadLink = document.createElement('a')
        downloadLink.href = blobUrl
        downloadLink.download = pdfFilename
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(blobUrl)

        // Fire-and-forget: save individual page images linked to songs
        deletePageImagesForConti(conti.id).then(() => {
          const uploadPromises = pageUploads.map(async (pu) => {
            const fd = new FormData()
            const blob = await (await fetch(pu.dataUrl)).blob()
            fd.set('file', blob, `page-${pu.pageIndex}.jpg`)
            fd.set('songId', pu.songId)
            fd.set('contiId', conti.id)
            fd.set('pageIndex', String(pu.pageIndex))
            fd.set('sheetMusicFileId', pu.sheetMusicFileId ?? '')
            fd.set('pdfPageIndex', pu.pdfPageIndex !== null ? String(pu.pdfPageIndex) : '')
            fd.set('presetSnapshot', pu.presetSnapshot)
            return saveSongPageImageFromForm(fd)
          })
          Promise.allSettled(uploadPromises).then(results => {
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
            if (failed.length > 0) {
              console.error(`[PDF Export] ${failed.length}/${results.length} page image uploads failed`)
            }
          })
        }).catch(err => {
          console.error('[PDF Export] Failed to clean up old page images:', err)
        })
      } else {
        toast.error(result.error ?? 'PDF 생성 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('[PDF Export] Export failed:', error)
      toast.error('PDF 생성 중 오류가 발생했습니다')
    } finally {
      setExporting(false)
    }
  }

  // Navigation
  function goToPrevPage() {
    setSelectedOverlayId(null)
    setImageSelected(false)
    setIsCropMode(false)
    setCropSelection(null)
    setCurrentPageIndex((i) => Math.max(0, i - 1))
  }

  function goToNextPage() {
    setSelectedOverlayId(null)
    setImageSelected(false)
    setIsCropMode(false)
    setCropSelection(null)
    setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1))
  }

  // Mobile guard
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
        <p className="text-muted-foreground text-xl">
          이 기능은 PC에서 사용해주세요
        </p>
        <Link
          href={`/contis/${conti.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-8" />
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
        <div className="aspect-[1/1.414] w-full max-w-3xl mx-auto bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  const currentPage = pages[currentPageIndex]
  const songName = currentPage
    ? conti.songs[currentPage.songIndex]?.song.name ?? ''
    : ''

  return (
    <div className="flex flex-col gap-4">
      {/* Consolidated Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Song name */}
        <span className="text-base font-medium text-muted-foreground truncate min-w-0">
          {songName}
        </span>

        {/* Center: Image tools */}
        <div className="flex items-center gap-2 shrink-0">
          {currentPage?.imageUrl && (
            <>
              <span className="text-sm tabular-nums text-muted-foreground">{currentPage.imageScale.toFixed(1)}x</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateImageTransform({ imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 })}
                disabled={currentPage.imageScale === 1 && currentPage.imageOffsetX === 0 && currentPage.imageOffsetY === 0}
              >
                초기화
              </Button>
              {!isCropMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCropMode(true)
                    setCropSelection(null)
                    setIsCropDragging(false)
                    setImageResizeHandle(null)
                    setImageSelected(false)
                  }}
                  disabled={!currentPage.imageUrl}
                >
                  <HugeiconsIcon icon={CropIcon} strokeWidth={2} data-icon="inline-start" />
                  자르기
                </Button>
              )}
              {isCropMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCropMode}
                >
                  자르기 취소
                </Button>
              )}
              {currentPage.originalImageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndoCrop}
                >
                  자르기 복원
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newOverlay: OverlayElement = {
                id: nanoid(),
                type: 'custom',
                text: '텍스트',
                x: 50,
                y: 50,
                fontSize: 16,
                color: '#000000',
              }
              setPages((prev) =>
                prev.map((page, i) => {
                  if (i !== currentPageIndex) return page
                  return { ...page, overlays: [...page.overlays, newOverlay] }
                }),
              )
              triggerAutoSave()
            }}
          >
            <HugeiconsIcon icon={TextFontIcon} strokeWidth={2} data-icon="inline-start" />
            텍스트 추가
          </Button>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-muted-foreground text-sm">
            {saveStatus === 'saved' && '저장됨'}
            {saveStatus === 'saving' && '저장 중...'}
            {saveStatus === 'unsaved' && '저장되지 않음'}
          </span>
          <Button variant="outline" size="sm" onClick={handleManualSave}>
            <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} data-icon="inline-start" />
            저장
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || pages.length === 0}>
            <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
            {exporting ? '생성 중...' : 'PDF 내보내기'}
          </Button>
          {pdfUrl && (
            <Button
              variant="outline"
              size="sm"
              render={
                <a
                  href={pdfUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              다운로드
            </Button>
          )}
        </div>
      </div>

      {/* Crop confirm/cancel toolbar */}
      {isCropMode && cropSelection && !isCropDragging && (
        <div className="flex items-center justify-center gap-4">
          <span className="text-base text-muted-foreground">선택 영역을 조절한 후</span>
          <Button size="sm" onClick={handleCropConfirm}>
            자르기 확인
          </Button>
          <Button size="sm" variant="outline" onClick={handleCropCancel}>
            취소
          </Button>
        </div>
      )}

      {/* Overlay edit toolbar */}
      {(() => {
        if (!selectedOverlayId || !currentPage) return null
        const overlay = currentPage.overlays.find((o) => o.id === selectedOverlayId)
        if (!overlay) return null
        const typeLabel = overlay.type === 'songNumber' ? '곡 번호' : overlay.type === 'sectionOrder' ? '섹션 순서' : overlay.type === 'bpm' ? 'BPM' : '텍스트'
        return (
          <div className="flex items-center justify-center gap-4" data-toolbar>
            <span className="text-base font-medium">{typeLabel}</span>
            <span className="text-base text-muted-foreground">글꼴 크기</span>
            <input
              type="number"
              min={8}
              max={72}
              step={1}
              value={overlay.fontSize}
              onChange={(e) => updateOverlay(selectedOverlayId, { fontSize: parseInt(e.target.value) || 14 })}
              className="w-20 rounded border px-3 py-1.5 text-base"
            />
            <span className="text-base text-muted-foreground">글꼴 색상</span>
            <input
              type="color"
              value={overlay.color ?? '#000000'}
              onChange={(e) => updateOverlay(selectedOverlayId, { color: e.target.value })}
              className="h-10 w-10 rounded border cursor-pointer"
            />
            {overlay.type === 'custom' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPages((prev) =>
                    prev.map((page, i) => {
                      if (i !== currentPageIndex) return page
                      return {
                        ...page,
                        overlays: page.overlays.filter((o) => o.id !== selectedOverlayId),
                      }
                    }),
                  )
                  setSelectedOverlayId(null)
                  triggerAutoSave()
                }}
              >
                <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} data-icon="inline-start" />
                삭제
              </Button>
            )}
          </div>
        )
      })()}

      {/* Canvas Area */}
      {currentPage && (
        <div
          ref={containerRef}
          className={`relative aspect-[1/1.414] w-full max-w-3xl mx-auto border rounded-lg bg-white ${isPanningImage ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
        >
          <div className="absolute inset-0 overflow-hidden">
          {/* Sheet music background */}
          {currentPage.imageUrl ? (
            <img
              src={currentPage.imageUrl}
              alt={`악보 - ${songName}`}
              className="absolute pointer-events-none"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transformOrigin: '0 0',
                transform: `scale(${currentPage.imageScale}) translate(${currentPage.imageOffsetX / currentPage.imageScale}%, ${currentPage.imageOffsetY / currentPage.imageScale}%)`,
              }}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                imgNaturalSizeRef.current = { width: img.naturalWidth, height: img.naturalHeight }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {currentPage.pdfPageIndex !== null
                ? 'PDF 페이지 로딩 중...'
                : songName}
            </div>
          )}

          {/* Crop mode overlay */}
          {isCropMode && currentPage?.imageUrl && (
            <>
              <div
                className="absolute inset-0 z-10"
                style={{
                  backgroundColor: cropSelection === null ? 'rgba(0, 0, 0, 0.4)' : 'transparent',
                  cursor: 'crosshair',
                }}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
              />

              {cropSelection && (
                <>
                  <div
                    className="absolute z-20 border-2 border-white pointer-events-none"
                    style={{
                      left: `${Math.min(cropSelection.startX, cropSelection.endX)}%`,
                      top: `${Math.min(cropSelection.startY, cropSelection.endY)}%`,
                      width: `${Math.abs(cropSelection.endX - cropSelection.startX)}%`,
                      height: `${Math.abs(cropSelection.endY - cropSelection.startY)}%`,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                      backgroundColor: 'transparent',
                    }}
                  />
                  {/* Corner handles */}
                  {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
                    const isLeft = corner === 'tl' || corner === 'bl'
                    const isTop = corner === 'tl' || corner === 'tr'
                    return (
                      <div
                        key={corner}
                        className="absolute z-20 w-5 h-5 bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize"
                        style={{
                          left: `${isLeft ? Math.min(cropSelection.startX, cropSelection.endX) : Math.max(cropSelection.startX, cropSelection.endX)}%`,
                          top: `${isTop ? Math.min(cropSelection.startY, cropSelection.endY) : Math.max(cropSelection.startY, cropSelection.endY)}%`,
                          transform: 'translate(-50%, -50%)',
                          cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
                        }}
                        onPointerDown={(e) => handleResizePointerDown(e, corner)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                      />
                    )
                  })}
                  {/* Edge handles */}
                  {(['top', 'right', 'bottom', 'left'] as const).map((edge) => {
                    const left = Math.min(cropSelection.startX, cropSelection.endX)
                    const top = Math.min(cropSelection.startY, cropSelection.endY)
                    const right = Math.max(cropSelection.startX, cropSelection.endX)
                    const bottom = Math.max(cropSelection.startY, cropSelection.endY)
                    const midX = (left + right) / 2
                    const midY = (top + bottom) / 2

                    const pos = edge === 'top' ? { left: midX, top: top }
                      : edge === 'right' ? { left: right, top: midY }
                      : edge === 'bottom' ? { left: midX, top: bottom }
                      : { left: left, top: midY }

                    return (
                      <div
                        key={edge}
                        className="absolute z-20 bg-white border-2 border-blue-500 rounded-sm"
                        style={{
                          left: `${pos.left}%`,
                          top: `${pos.top}%`,
                          width: edge === 'top' || edge === 'bottom' ? '12px' : '6px',
                          height: edge === 'top' || edge === 'bottom' ? '6px' : '12px',
                          transform: 'translate(-50%, -50%)',
                          cursor: edge === 'top' || edge === 'bottom' ? 'ns-resize' : 'ew-resize',
                        }}
                        onPointerDown={(e) => handleResizePointerDown(e, edge)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                      />
                    )
                  })}
                </>
              )}
            </>
          )}

          {/* Overlay elements */}
          {currentPage.overlays.map((overlay) => (
            <div
              key={overlay.id}
              data-overlay
              className={`absolute cursor-move select-none px-2 py-1 rounded transition-colors ${
                draggingId === overlay.id
                  ? 'border-2 border-blue-500 bg-blue-50/80'
                  : selectedOverlayId === overlay.id
                    ? 'border-2 border-blue-400 bg-blue-50/50'
                    : 'border border-transparent hover:border-gray-300 hover:bg-white/80'
              }`}
              style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                fontSize: `${overlay.fontSize}px`,
                fontWeight: overlay.type === 'songNumber' ? 700 : overlay.type === 'custom' ? 400 : 600,
                color: overlay.color ?? '#000000',
                transform:
                  overlay.type === 'bpm'
                    ? 'translateX(-100%)'
                    : overlay.type === 'sectionOrder'
                      ? 'translateX(-50%)'
                      : 'none',
                whiteSpace: 'nowrap',
                fontFamily: '"Pretendard Variable", Pretendard, -apple-system, sans-serif',
              }}
              onPointerDown={(e) => handlePointerDown(e, overlay.id)}
              onPointerMove={(e) => handlePointerMove(e, overlay.id)}
              onPointerUp={(e) => handlePointerUp(e, overlay.id)}
              onDoubleClick={() => handleDoubleClick()}
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
          {/* Image selection border + resize corner handles - OUTSIDE the clipping div */}
          {currentPage.imageUrl && !isCropMode && imageSelected && (() => {
            const bounds = getImageBounds(currentPage)
            return (
              <div
                className="absolute z-10 pointer-events-none border-2 border-blue-500 rounded-sm"
                style={{
                  left: `${bounds.left}%`,
                  top: `${bounds.top}%`,
                  width: `${bounds.right - bounds.left}%`,
                  height: `${bounds.bottom - bounds.top}%`,
                }}
              />
            )
          })()}
          {currentPage.imageUrl && !isCropMode && imageSelected && (() => {
            const bounds = getImageBounds(currentPage)
            return (['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
              const isLeft = corner === 'tl' || corner === 'bl'
              const isTop = corner === 'tl' || corner === 'tr'
              return (
                <div
                  key={`resize-${corner}`}
                  className="absolute z-10 w-4 h-4 bg-white border-2 border-blue-500 rounded-sm"
                  style={{
                    left: `${isLeft ? bounds.left : bounds.right}%`,
                    top: `${isTop ? bounds.top : bounds.bottom}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
                  }}
                  onPointerDown={(e) => handleImageResizeDown(e, corner)}
                  onPointerMove={handleImageResizeMove}
                  onPointerUp={handleImageResizeUp}
                />
              )
            })
          })()}
        </div>
      )}

      {/* Page Navigation */}
      {pages.length > 0 && (
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevPage}
            disabled={currentPageIndex === 0}
          >
            <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} />
          </Button>
          <span className="text-base text-muted-foreground tabular-nums">
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

      {exporting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-10 py-8 text-center">
            <p className="text-xl font-medium">PDF를 생성하는 중...</p>
            <p className="text-muted-foreground text-base mt-3">잠시만 기다려주세요</p>
          </div>
        </div>
      )}

      {pages.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-base">
            이 콘티에 악보가 없습니다. 먼저 곡에 악보를 추가해주세요.
          </p>
        </div>
      )}
    </div>
  )
}
