'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import type { SheetMusicFile } from '@/lib/types';
import { deleteSheetMusic } from '@/lib/actions/sheet-music';
import { getPdfPageCount, renderPdfPagesToDataUrls } from '@/lib/utils/pdfjs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface SheetMusicGalleryProps {
  files: SheetMusicFile[];
  editable?: boolean;
  songId?: string;
}

interface GalleryItem {
  file: SheetMusicFile;
  /** For images: the file URL. For PDF pages: a rendered data URL. */
  thumbnailUrl: string | null;
  /** 1-based page number for PDF pages, null for images */
  pdfPage: number | null;
  /** Total pages in the PDF (for display), null for images */
  pdfTotalPages: number | null;
}

export function SheetMusicGallery({ files, editable = false }: SheetMusicGalleryProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);

  // Stable key derived from file IDs to avoid re-running effects on parent re-renders
  const filesKey = useMemo(() => files.map((f) => f.id).join(','), [files]);
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  // Build gallery items and render PDF thumbnails in one pass per PDF
  useEffect(() => {
    let cancelled = false;
    const currentFiles = filesRef.current;

    async function buildItems() {
      const result: GalleryItem[] = [];

      for (const file of currentFiles) {
        if (file.fileType.startsWith('image/')) {
          result.push({ file, thumbnailUrl: file.fileUrl, pdfPage: null, pdfTotalPages: null });
        } else if (file.fileType === 'application/pdf') {
          try {
            const pageCount = await getPdfPageCount(file.fileUrl);
            // Placeholder items so the grid appears immediately
            const startIdx = result.length;
            for (let p = 1; p <= pageCount; p++) {
              result.push({ file, thumbnailUrl: null, pdfPage: p, pdfTotalPages: pageCount });
            }
            if (!cancelled) setItems([...result]);

            // Render all pages from this PDF in one document open
            const pageNums = Array.from({ length: pageCount }, (_, i) => i + 1);
            const dataUrls = await renderPdfPagesToDataUrls(file.fileUrl, pageNums, 1);
            if (!cancelled) {
              for (let p = 0; p < dataUrls.length; p++) {
                result[startIdx + p] = { ...result[startIdx + p], thumbnailUrl: dataUrls[p] };
              }
              setItems([...result]);
            }
          } catch (err) {
            console.error('[SheetMusicGallery] Failed to load PDF:', err);
            result.push({ file, thumbnailUrl: null, pdfPage: null, pdfTotalPages: null });
          }
        }
      }

      if (!cancelled) setItems(result);
    }

    buildItems();
    return () => { cancelled = true; };
  }, [filesKey]);

  const handleDelete = async (fileId: string) => {
    const result = await deleteSheetMusic(fileId);

    if (result.success) {
      toast('악보가 삭제되었습니다');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, idx) => (
          <div
            key={`${item.file.id}-${item.pdfPage ?? 'img'}`}
            className="relative group"
            onMouseEnter={() => setHoveredFileId(`${item.file.id}-${item.pdfPage}`)}
            onMouseLeave={() => setHoveredFileId(null)}
          >
            <div
              onClick={() => setSelectedItem(item)}
              className="cursor-pointer rounded-lg overflow-hidden border hover:border-primary/50 transition-colors"
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.pdfPage ? `${item.file.fileName} - ${item.pdfPage}페이지` : item.file.fileName}
                  className="w-full aspect-auto object-cover"
                />
              ) : (
                <div className="aspect-[1/1.414] flex items-center justify-center bg-muted animate-pulse">
                  <span className="text-sm text-muted-foreground">로딩 중...</span>
                </div>
              )}
              {item.pdfPage !== null && item.pdfTotalPages !== null && item.pdfTotalPages > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-sm px-2 py-1 rounded">
                  {item.pdfPage}/{item.pdfTotalPages}
                </div>
              )}
            </div>

            {editable && hoveredFileId === `${item.file.id}-${item.pdfPage}` && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>악보 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      {item.pdfTotalPages && item.pdfTotalPages > 1
                        ? `이 PDF 파일(${item.pdfTotalPages}페이지)을 삭제하시겠습니까?`
                        : '이 악보를 삭제하시겠습니까?'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(item.file.id)}>
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.file.fileName}
              {selectedItem?.pdfPage != null && ` - ${selectedItem.pdfPage}페이지`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-6">
            {selectedItem && selectedItem.thumbnailUrl && (
              <img
                src={selectedItem.thumbnailUrl}
                alt={selectedItem.file.fileName}
                className="max-h-[80vh] w-auto mx-auto"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
