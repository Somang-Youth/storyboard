"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { getSheetMusicForSong } from "@/lib/actions/sheet-music"
import { getPdfPageCount, renderPdfPagesToDataUrls } from "@/lib/utils/pdfjs"
import type { SheetMusicFile } from "@/lib/types"

interface SheetMusicSelectorProps {
  songId: string
  selectedFileIds: string[]
  onSelectionChange: (fileIds: string[]) => void
  availableFiles?: SheetMusicFile[]
}

interface SelectorItem {
  file: SheetMusicFile
  thumbnailUrl: string | null
  pdfPage: number | null
  pdfTotalPages: number | null
}

export function SheetMusicSelector({
  songId,
  selectedFileIds,
  onSelectionChange,
  availableFiles,
}: SheetMusicSelectorProps) {
  const [fetchedFiles, setFetchedFiles] = useState<SheetMusicFile[]>([])
  const [items, setItems] = useState<SelectorItem[]>([])
  const [loading, setLoading] = useState(!availableFiles)

  const files = availableFiles ?? fetchedFiles
  const filesKey = useMemo(() => files.map(f => f.id).join(","), [files])
  const filesRef = useRef(files)
  useEffect(() => { filesRef.current = files }, [files])

  // Fetch files if not provided as prop
  useEffect(() => {
    if (availableFiles) return
    getSheetMusicForSong(songId).then(result => {
      if (result.success && result.data) {
        setFetchedFiles(result.data)
      }
      setLoading(false)
    })
  }, [songId, availableFiles])

  // Build gallery items with PDF thumbnails
  useEffect(() => {
    let cancelled = false
    const currentFiles = filesRef.current

    async function buildItems() {
      const result: SelectorItem[] = []

      for (const file of currentFiles) {
        if (file.fileType.startsWith("image/")) {
          result.push({ file, thumbnailUrl: file.fileUrl, pdfPage: null, pdfTotalPages: null })
        } else if (file.fileType === "application/pdf") {
          try {
            const pageCount = await getPdfPageCount(file.fileUrl)
            const startIdx = result.length
            for (let p = 1; p <= pageCount; p++) {
              result.push({ file, thumbnailUrl: null, pdfPage: p, pdfTotalPages: pageCount })
            }
            if (!cancelled) setItems([...result])

            const pageNums = Array.from({ length: pageCount }, (_, i) => i + 1)
            const dataUrls = await renderPdfPagesToDataUrls(file.fileUrl, pageNums, 1)
            if (!cancelled) {
              for (let p = 0; p < dataUrls.length; p++) {
                result[startIdx + p] = { ...result[startIdx + p], thumbnailUrl: dataUrls[p] }
              }
              setItems([...result])
            }
          } catch {
            result.push({ file, thumbnailUrl: null, pdfPage: null, pdfTotalPages: null })
          }
        }
      }

      if (!cancelled) setItems(result)
    }

    buildItems()
    return () => { cancelled = true }
  }, [filesKey])

  const selectedSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds])

  const toggleFile = (fileId: string) => {
    if (selectedSet.has(fileId)) {
      onSelectionChange(selectedFileIds.filter(id => id !== fileId))
    } else {
      onSelectionChange([...selectedFileIds, fileId])
    }
  }

  const allFileIds = useMemo(() => files.map(f => f.id), [files])
  const allSelected = allFileIds.length > 0 && allFileIds.every(id => selectedSet.has(id))

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(allFileIds)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-2">악보 불러오는 중...</div>
  }

  if (files.length === 0) {
    return <div className="text-sm text-muted-foreground py-2">등록된 악보가 없습니다</div>
  }

  // Group items by file ID to render selection per-file (not per-page)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
          {allSelected ? "선택 해제" : "전체 선택"}
        </Button>
        {selectedFileIds.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedFileIds.length}개 선택됨
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {items.map((item) => {
          // For multi-page PDFs, only show selection on the first page
          if (item.pdfPage !== null && item.pdfPage > 1) {
            // Show subsequent pages without selection toggle (they follow their file)
            const isFileSelected = selectedSet.has(item.file.id)
            return (
              <div
                key={`${item.file.id}-p${item.pdfPage}`}
                className={`relative rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                  isFileSelected ? "border-primary" : "border-transparent"
                }`}
                onClick={() => toggleFile(item.file.id)}
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={`${item.file.fileName} - ${item.pdfPage}페이지`}
                    className="w-full aspect-auto object-cover"
                  />
                ) : (
                  <div className="aspect-[1/1.414] flex items-center justify-center bg-muted animate-pulse">
                    <span className="text-xs text-muted-foreground">로딩 중...</span>
                  </div>
                )}
                {item.pdfTotalPages && item.pdfTotalPages > 1 && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                    {item.pdfPage}/{item.pdfTotalPages}
                  </div>
                )}
              </div>
            )
          }

          const isSelected = selectedSet.has(item.file.id)
          return (
            <div
              key={`${item.file.id}-${item.pdfPage ?? "img"}`}
              className={`relative rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                isSelected ? "border-primary" : "border-muted hover:border-primary/30"
              }`}
              onClick={() => toggleFile(item.file.id)}
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.pdfPage ? `${item.file.fileName} - ${item.pdfPage}페이지` : item.file.fileName}
                  className="w-full aspect-auto object-cover"
                />
              ) : (
                <div className="aspect-[1/1.414] flex items-center justify-center bg-muted animate-pulse">
                  <span className="text-xs text-muted-foreground">로딩 중...</span>
                </div>
              )}
              {isSelected && (
                <div className="absolute top-1 right-1">
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={2}
                    className="size-5 text-primary drop-shadow"
                  />
                </div>
              )}
              {item.pdfPage !== null && item.pdfTotalPages !== null && item.pdfTotalPages > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  {item.pdfPage}/{item.pdfTotalPages}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
