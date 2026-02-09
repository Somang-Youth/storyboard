'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
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
  CropIcon,
} from '@hugeicons/core-free-icons'
import { buildDefaultOverlays } from '@/lib/utils/pdf-export-helpers'
import { saveContiPdfLayout, exportContiPdf } from '@/lib/actions/conti-pdf-exports'
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

  const containerRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const panStartRef = useRef<{ x: number; y: number; offX: number; offY: number }>({ x: 0, y: 0, offX: 0, offY: 0 })
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const resizeStartRef = useRef<{
    x: number; y: number;
    scale: number; offX: number; offY: number;
    containerW: number; containerH: number;
  }>({ x: 0, y: 0, scale: 1, offX: 0, offY: 0, containerW: 0, containerH: 0 })
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
        .then(async (dataUrl) => {
          let finalUrl = dataUrl
          if (page.cropX !== null && page.cropY !== null && page.cropWidth !== null && page.cropHeight !== null) {
            try {
              finalUrl = await applySavedCrop(dataUrl, page.cropX, page.cropY, page.cropWidth, page.cropHeight)
            } catch {
              // Fall back to uncropped
            }
          }
          setPages((prev) =>
            prev.map((p, i) =>
              i === currentPageIndex
                ? { ...p, imageUrl: finalUrl, originalImageUrl: page.cropX !== null ? dataUrl : null }
                : p,
            ),
          )
        })
        .catch(() => {
          // Failed to render PDF page
        })
    }
  }, [currentPageIndex, pages, conti.songs])

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
        const newPage = { ...page, ...updates }
        // Re-clamp offsets when scale changes
        if (updates.imageScale !== undefined) {
          const rawOffset = -(newPage.imageScale - 1) * 100
          const minOffset = Math.min(0, rawOffset)
          const maxOffset = Math.max(0, rawOffset)
          newPage.imageOffsetX = Math.max(minOffset, Math.min(maxOffset, newPage.imageOffsetX))
          newPage.imageOffsetY = Math.max(minOffset, Math.min(maxOffset, newPage.imageOffsetY))
        }
        return newPage
      }),
    )
    triggerAutoSave()
  }

  // Update image transform without triggering auto-save (for continuous drag/slider)
  function updateImageTransformSilent(updates: Partial<{ imageScale: number; imageOffsetX: number; imageOffsetY: number }>) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page
        const newPage = { ...page, ...updates }
        if (updates.imageScale !== undefined) {
          const rawOffset = -(newPage.imageScale - 1) * 100
          const minOffset = Math.min(0, rawOffset)
          const maxOffset = Math.max(0, rawOffset)
          newPage.imageOffsetX = Math.max(minOffset, Math.min(maxOffset, newPage.imageOffsetX))
          newPage.imageOffsetY = Math.max(minOffset, Math.min(maxOffset, newPage.imageOffsetY))
        }
        return newPage
      }),
    )
  }

  // Helper function to get image bounds
  function getImageBounds(page: EditorPage) {
    const s = page.imageScale
    const offX = page.imageOffsetX
    const offY = page.imageOffsetY
    return {
      left: offX,
      top: offY,
      right: offX + s * 100,
      bottom: offY + s * 100,
    }
  }

  // Container-level pointer handlers for image panning
  function handleContainerPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    // Clear selection on background click (not overlay, not toolbar)
    if (!target.closest('[data-overlay]') && !target.closest('[data-toolbar]')) {
      setSelectedOverlayId(null)
    }

    // Only pan if clicking on the image/background area, not on an overlay
    if (target.closest('[data-overlay]') || target.closest('[data-toolbar]')) return

    if (isCropMode) return

    const currentPg = pages[currentPageIndex]
    if (!currentPg || currentPg.imageScale === 1) return

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

    const rawOffset = -(currentPg.imageScale - 1) * 100
    const minOffset = Math.min(0, rawOffset)
    const maxOffset = Math.max(0, rawOffset)
    const newOffX = Math.max(minOffset, Math.min(maxOffset, panStartRef.current.offX + deltaXPct))
    const newOffY = Math.max(minOffset, Math.min(maxOffset, panStartRef.current.offY + deltaYPct))

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
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scale: currentPg.imageScale,
      offX: currentPg.imageOffsetX,
      offY: currentPg.imageOffsetY,
      containerW: rect.width,
      containerH: rect.height,
    }
    setImageResizeHandle(corner)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleImageResizeMove(e: React.PointerEvent) {
    if (!imageResizeHandle) return
    const { scale: startScale, offX: startOffX, offY: startOffY, containerW, containerH } = resizeStartRef.current
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    const ptrXPct = ((e.clientX - rect.left) / rect.width) * 100
    const ptrYPct = ((e.clientY - rect.top) / rect.height) * 100

    // Determine anchor corner (opposite of dragged corner)
    let anchorXPct: number, anchorYPct: number
    if (imageResizeHandle === 'br') {
      anchorXPct = startOffX
      anchorYPct = startOffY
    } else if (imageResizeHandle === 'tl') {
      anchorXPct = startOffX + startScale * 100
      anchorYPct = startOffY + startScale * 100
    } else if (imageResizeHandle === 'tr') {
      anchorXPct = startOffX
      anchorYPct = startOffY + startScale * 100
    } else {
      // bl
      anchorXPct = startOffX + startScale * 100
      anchorYPct = startOffY
    }

    const initDist = startScale * 100
    // Distance from anchor to current pointer
    const currDistX = Math.abs(ptrXPct - anchorXPct)
    const currDistY = Math.abs(ptrYPct - anchorYPct)
    const maxDist = Math.max(currDistX, currDistY)
    if (maxDist < 1) return // avoid division by near-zero

    const newScale = Math.max(0.3, Math.min(3.0, (maxDist / initDist) * startScale))

    // Compute offset so anchor corner stays fixed
    let newOffX: number, newOffY: number
    if (imageResizeHandle === 'br') {
      newOffX = startOffX
      newOffY = startOffY
    } else if (imageResizeHandle === 'tl') {
      newOffX = startOffX + (startScale - newScale) * 100
      newOffY = startOffY + (startScale - newScale) * 100
    } else if (imageResizeHandle === 'tr') {
      newOffX = startOffX
      newOffY = startOffY + (startScale - newScale) * 100
    } else {
      // bl
      newOffX = startOffX + (startScale - newScale) * 100
      newOffY = startOffY
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

  // Drag handlers
  function handlePointerDown(e: React.PointerEvent, overlayId: string) {
    e.stopPropagation()
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

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = 595.28
      const pageHeight = 841.89

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage()

        // Create a temporary render container
        const renderDiv = document.createElement('div')
        renderDiv.style.width = `${pageWidth}px`
        renderDiv.style.height = `${pageHeight}px`
        renderDiv.style.position = 'relative'
        renderDiv.style.background = 'white'
        renderDiv.style.overflow = 'hidden'
        document.body.appendChild(renderDiv)

        const page = pages[i]

        // Render sheet music image
        if (page.imageUrl) {
          const scale = page.imageScale ?? 1
          const offX = page.imageOffsetX ?? 0
          const offY = page.imageOffsetY ?? 0

          const img = document.createElement('img')
          img.src = page.imageUrl
          img.style.position = 'absolute'
          img.style.width = '100%'
          img.style.height = '100%'
          img.style.objectFit = 'contain'
          img.style.transformOrigin = '0 0'
          img.style.transform = `scale(${scale}) translate(${offX / scale}%, ${offY / scale}%)`
          img.crossOrigin = 'anonymous'
          renderDiv.appendChild(img)
          // Wait for image to load
          await new Promise<void>((resolve) => {
            if (img.complete) { resolve(); return }
            img.onload = () => resolve()
            img.onerror = () => resolve()
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
          renderDiv.appendChild(placeholder)
        }

        // Render overlays
        for (const overlay of page.overlays) {
          const el = document.createElement('div')
          el.style.position = 'absolute'
          el.style.left = `${overlay.x}%`
          el.style.top = `${overlay.y}%`
          el.style.fontSize = `${overlay.fontSize}px`
          el.style.fontWeight = overlay.type === 'songNumber' ? '700' : '600'
          el.style.whiteSpace = 'nowrap'
          el.style.transform =
            overlay.type === 'bpm'
              ? 'translateX(-100%)'
              : overlay.type === 'sectionOrder'
                ? 'translateX(-50%)'
                : 'none'
          el.textContent = overlay.text
          el.style.color = overlay.color ?? '#000000'
          renderDiv.appendChild(el)
        }

        // Capture to canvas
        const canvas = await html2canvas(renderDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          width: pageWidth,
          height: pageHeight,
        })

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        doc.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight)

        // Clean up
        document.body.removeChild(renderDiv)
      }

      // Generate blob and upload
      const pdfBlob = doc.output('blob')
      const formData = new FormData()
      formData.append('file', pdfBlob, 'conti-export.pdf')

      const result = await exportContiPdf(conti.id, formData)
      if (result.success && result.data) {
        toast.success('PDF가 생성되었습니다')
        setPdfUrl(result.data.pdfUrl)
      } else {
        toast.error(result.error ?? 'PDF 생성 중 오류가 발생했습니다')
      }
    } catch (error) {
      toast.error('PDF 생성 중 오류가 발생했습니다')
    } finally {
      setExporting(false)
    }
  }

  // Navigation
  function goToPrevPage() {
    setSelectedOverlayId(null)
    setIsCropMode(false)
    setCropSelection(null)
    setCurrentPageIndex((i) => Math.max(0, i - 1))
  }

  function goToNextPage() {
    setSelectedOverlayId(null)
    setIsCropMode(false)
    setCropSelection(null)
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
        <Button variant="outline" onClick={handleExport} disabled={exporting || pages.length === 0}>
          <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
          {exporting ? 'PDF 생성 중...' : 'PDF 내보내기'}
        </Button>
        {pdfUrl && (
          <Button
            variant="outline"
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

      {/* Image Transform Toolbar */}
      {currentPage?.imageUrl && (
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">{currentPage.imageScale.toFixed(1)}x</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateImageTransform({ imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 })}
            disabled={currentPage.imageScale === 1 && currentPage.imageOffsetX === 0 && currentPage.imageOffsetY === 0}
          >
            초기화
          </Button>
          <Button
            variant={isCropMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setIsCropMode(!isCropMode)
              setCropSelection(null)
              setIsCropDragging(false)
              setImageResizeHandle(null)
            }}
            disabled={!currentPage?.imageUrl}
          >
            <HugeiconsIcon icon={CropIcon} strokeWidth={2} data-icon="inline-start" />
            자르기
          </Button>
          {currentPage?.originalImageUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndoCrop}
            >
              자르기 취소
            </Button>
          )}
        </div>
      )}

      {/* Crop confirm/cancel toolbar */}
      {isCropMode && cropSelection && !isCropDragging && (
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">선택 영역을 조절한 후</span>
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
        const typeLabel = overlay.type === 'songNumber' ? '곡 번호' : overlay.type === 'sectionOrder' ? '섹션 순서' : 'BPM'
        return (
          <div className="flex items-center justify-center gap-3" data-toolbar>
            <span className="text-sm font-medium">{typeLabel}</span>
            <span className="text-sm text-muted-foreground">글꼴 크기</span>
            <input
              type="number"
              min={8}
              max={72}
              step={1}
              value={overlay.fontSize}
              onChange={(e) => updateOverlay(selectedOverlayId, { fontSize: parseInt(e.target.value) || 14 })}
              className="w-16 rounded border px-2 py-1 text-sm"
            />
            <span className="text-sm text-muted-foreground">글꼴 색상</span>
            <input
              type="color"
              value={overlay.color ?? '#000000'}
              onChange={(e) => updateOverlay(selectedOverlayId, { color: e.target.value })}
              className="h-8 w-8 rounded border cursor-pointer"
            />
          </div>
        )
      })()}

      {/* Canvas Area */}
      {currentPage && (
        <div
          ref={containerRef}
          className={`relative aspect-[1/1.414] w-full max-w-3xl mx-auto border rounded-lg overflow-hidden bg-white ${currentPage?.imageScale !== 1 ? (isPanningImage ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
        >
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
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {currentPage.pdfPageIndex !== null
                ? 'PDF 페이지 로딩 중...'
                : songName}
            </div>
          )}

          {/* Image resize corner handles */}
          {currentPage.imageUrl && !isCropMode && (() => {
            const bounds = getImageBounds(currentPage)
            return (['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
              const isLeft = corner === 'tl' || corner === 'bl'
              const isTop = corner === 'tl' || corner === 'tr'
              return (
                <div
                  key={`resize-${corner}`}
                  className="absolute z-10 w-3 h-3 bg-white border-2 border-blue-500 rounded-sm"
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
                        className="absolute z-20 w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize"
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
              className={`absolute cursor-move select-none px-1.5 py-0.5 rounded transition-colors ${
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
                fontWeight: overlay.type === 'songNumber' ? 700 : 600,
                color: overlay.color ?? '#000000',
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
      )}

      {exporting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-8 py-6 text-center">
            <p className="text-lg font-medium">PDF를 생성하는 중...</p>
            <p className="text-muted-foreground text-sm mt-2">잠시만 기다려주세요</p>
          </div>
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
