import { useState, useEffect, useRef } from "react";
import {
  buildDefaultOverlays,
  findPresetPdfPageMetadata,
  mergePresetOverlays,
} from "@/lib/utils/pdf-export-helpers";
import { getPdfPageCount, renderPdfPageToDataUrl } from "@/lib/utils/pdfjs";
import { applySavedCrop } from "../utils";
import type {
  ContiWithSongsAndSheetMusic,
  ContiPdfExport,
  PdfLayoutState,
  PageLayout,
} from "@/lib/types";
import type { EditorPage } from "../types";

export function useEditorPages(
  conti: ContiWithSongsAndSheetMusic,
  existingExport: ContiPdfExport | null,
) {
  const [pages, setPages] = useState<EditorPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Guards against duplicate PDF page renders
  const renderingPageRef = useRef<Set<number>>(new Set());

  // Initialize pages from conti data
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      // Parse existing layout state if available
      let savedLayouts: PageLayout[] | null = null;
      if (existingExport?.layoutState) {
        try {
          const parsed: PdfLayoutState = JSON.parse(existingExport.layoutState);
          savedLayouts = parsed.pages;
        } catch {
          // Ignore invalid JSON
        }
      }

      const editorPages: EditorPage[] = [];

      for (let songIdx = 0; songIdx < conti.songs.length; songIdx++) {
        const contiSong = conti.songs[songIdx];
        const sheetMusic = contiSong.sheetMusic;

        if (sheetMusic.length === 0) {
          // Metadata-only page
          const defaultOverlays = buildDefaultOverlays(
            songIdx,
            contiSong.overrides.sectionOrder,
            contiSong.overrides.tempos,
          );
          const saved = savedLayouts?.find(
            (l) => l.songIndex === songIdx && l.sheetMusicFileId === null,
          );
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
          });
          continue;
        }

        for (const file of sheetMusic) {
          if (file.fileType.includes("image")) {
            const defaultOverlays = buildDefaultOverlays(
              songIdx,
              contiSong.overrides.sectionOrder,
              contiSong.overrides.tempos,
            );
            const saved = savedLayouts?.find(
              (l) => l.songIndex === songIdx && l.sheetMusicFileId === file.id,
            );
            const preset = findPresetPdfPageMetadata(
              contiSong.presetPdfMetadata,
              file.id,
              null,
            );
            editorPages.push({
              songIndex: songIdx,
              sheetMusicFileId: file.id,
              imageUrl: file.fileUrl,
              pdfPageIndex: null,
              overlays:
                saved?.overlays ??
                mergePresetOverlays(
                  preset?.overlays,
                  songIdx,
                  contiSong.overrides.sectionOrder,
                  contiSong.overrides.tempos,
                ) ??
                defaultOverlays,
              imageScale: saved?.imageScale ?? preset?.imageScale ?? 1,
              imageOffsetX: saved?.imageOffsetX ?? preset?.imageOffsetX ?? 0,
              imageOffsetY: saved?.imageOffsetY ?? preset?.imageOffsetY ?? 0,
              cropX: saved?.cropX ?? preset?.cropX ?? null,
              cropY: saved?.cropY ?? preset?.cropY ?? null,
              cropWidth: saved?.cropWidth ?? preset?.cropWidth ?? null,
              cropHeight: saved?.cropHeight ?? preset?.cropHeight ?? null,
              originalImageUrl: saved?.originalImageUrl ?? null,
            });
          } else if (file.fileType.includes("pdf")) {
            try {
              const pageCount = await getPdfPageCount(file.fileUrl);
              for (let p = 0; p < pageCount; p++) {
                const defaultOverlays = buildDefaultOverlays(
                  songIdx,
                  contiSong.overrides.sectionOrder,
                  contiSong.overrides.tempos,
                );
                const saved =
                  savedLayouts?.find(
                    (l) =>
                      l.songIndex === songIdx &&
                      l.sheetMusicFileId === file.id &&
                      (l.pdfPageIndex ?? null) === p,
                  ) ??
                  savedLayouts?.find(
                    (l) =>
                      l.songIndex === songIdx &&
                      l.sheetMusicFileId === file.id &&
                      l.pageIndex === editorPages.length,
                  );
                const preset = findPresetPdfPageMetadata(
                  contiSong.presetPdfMetadata,
                  file.id,
                  p,
                );
                editorPages.push({
                  songIndex: songIdx,
                  sheetMusicFileId: file.id,
                  imageUrl: null,
                  pdfPageIndex: p,
                  overlays:
                    saved?.overlays ??
                    mergePresetOverlays(
                      preset?.overlays,
                      songIdx,
                      contiSong.overrides.sectionOrder,
                      contiSong.overrides.tempos,
                    ) ??
                    defaultOverlays,
                  imageScale: saved?.imageScale ?? preset?.imageScale ?? 1,
                  imageOffsetX: saved?.imageOffsetX ?? preset?.imageOffsetX ?? 0,
                  imageOffsetY: saved?.imageOffsetY ?? preset?.imageOffsetY ?? 0,
                  cropX: saved?.cropX ?? preset?.cropX ?? null,
                  cropY: saved?.cropY ?? preset?.cropY ?? null,
                  cropWidth: saved?.cropWidth ?? preset?.cropWidth ?? null,
                  cropHeight: saved?.cropHeight ?? preset?.cropHeight ?? null,
                  originalImageUrl: saved?.originalImageUrl ?? null,
                });
              }
            } catch {
              const defaultOverlays = buildDefaultOverlays(
                songIdx,
                contiSong.overrides.sectionOrder,
                contiSong.overrides.tempos,
              );
              const savedFallback = savedLayouts?.find(
                (l) =>
                  l.songIndex === songIdx && l.sheetMusicFileId === file.id,
              );
              const presetFallback = findPresetPdfPageMetadata(
                contiSong.presetPdfMetadata,
                file.id,
                null,
              );
              editorPages.push({
                songIndex: songIdx,
                sheetMusicFileId: file.id,
                imageUrl: null,
                pdfPageIndex: null,
                overlays:
                  savedFallback?.overlays ??
                  mergePresetOverlays(
                    presetFallback?.overlays,
                    songIdx,
                    contiSong.overrides.sectionOrder,
                    contiSong.overrides.tempos,
                  ) ??
                  defaultOverlays,
                imageScale:
                  savedFallback?.imageScale ?? presetFallback?.imageScale ?? 1,
                imageOffsetX:
                  savedFallback?.imageOffsetX ?? presetFallback?.imageOffsetX ?? 0,
                imageOffsetY:
                  savedFallback?.imageOffsetY ?? presetFallback?.imageOffsetY ?? 0,
                cropX: savedFallback?.cropX ?? presetFallback?.cropX ?? null,
                cropY: savedFallback?.cropY ?? presetFallback?.cropY ?? null,
                cropWidth:
                  savedFallback?.cropWidth ?? presetFallback?.cropWidth ?? null,
                cropHeight:
                  savedFallback?.cropHeight ?? presetFallback?.cropHeight ?? null,
                originalImageUrl: savedFallback?.originalImageUrl ?? null,
              });
            }
          }
        }
      }

      // Re-apply saved crops for image files
      for (let idx = 0; idx < editorPages.length; idx++) {
        const ep = editorPages[idx];
        if (
          ep.cropX !== null &&
          ep.cropY !== null &&
          ep.cropWidth !== null &&
          ep.cropHeight !== null &&
          ep.originalImageUrl
        ) {
          try {
            const croppedUrl = await applySavedCrop(
              ep.originalImageUrl,
              ep.cropX,
              ep.cropY,
              ep.cropWidth,
              ep.cropHeight,
            );
            editorPages[idx] = { ...ep, imageUrl: croppedUrl };
          } catch {
            editorPages[idx] = {
              ...ep,
              imageUrl: ep.originalImageUrl,
              originalImageUrl: null,
              cropX: null,
              cropY: null,
              cropWidth: null,
              cropHeight: null,
            };
          }
        }
      }

      if (!cancelled) {
        setPages(editorPages);
        setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [conti, existingExport]);

  // Render PDF page image lazily when navigating to a PDF page
  useEffect(() => {
    setPages((prev) => {
      const page = prev[currentPageIndex];
      if (!page) return prev;
      if (page.pdfPageIndex === null || page.imageUrl || !page.sheetMusicFileId)
        return prev;
      if (renderingPageRef.current.has(currentPageIndex)) return prev;
      renderingPageRef.current.add(currentPageIndex);

      // Find the file URL from conti data
      let fileUrl: string | null = null;
      for (const cs of conti.songs) {
        for (const sm of cs.sheetMusic) {
          if (sm.id === page.sheetMusicFileId) {
            fileUrl = sm.fileUrl;
            break;
          }
        }
        if (fileUrl) break;
      }
      if (!fileUrl) {
        renderingPageRef.current.delete(currentPageIndex);
        return prev;
      }

      const pageIdx = currentPageIndex;
      renderPdfPageToDataUrl(fileUrl, page.pdfPageIndex + 1)
        .then(async (dataUrl) => {
          let finalUrl = dataUrl;
          if (
            page.cropX !== null &&
            page.cropY !== null &&
            page.cropWidth !== null &&
            page.cropHeight !== null
          ) {
            try {
              finalUrl = await applySavedCrop(
                dataUrl,
                page.cropX,
                page.cropY,
                page.cropWidth,
                page.cropHeight,
              );
            } catch {
              // Fall back to uncropped
            }
          }
          setPages((p) =>
            p.map((pg, i) =>
              i === pageIdx && !pg.imageUrl
                ? {
                    ...pg,
                    imageUrl: finalUrl,
                    originalImageUrl: page.cropX !== null ? dataUrl : null,
                  }
                : pg,
            ),
          );
        })
        .catch((err) => {
          console.error("[PDF Editor] Failed to render PDF page:", err);
        })
        .finally(() => {
          renderingPageRef.current.delete(pageIdx);
        });

      return prev;
    });
  }, [currentPageIndex, conti.songs, loading]);

  const currentPage = pages[currentPageIndex];

  return {
    pages,
    setPages,
    currentPageIndex,
    setCurrentPageIndex,
    loading,
    currentPage,
  };
}
