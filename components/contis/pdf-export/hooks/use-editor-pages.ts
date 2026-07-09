import { useState, useEffect, useRef, useCallback } from "react";
import {
  buildDefaultOverlays,
  findPresetPdfPageMetadata,
  mergePresetOverlays,
} from "@/lib/utils/pdf-export-helpers";
import { buildArrangementItems } from "@/lib/utils/arrangement-items";
import { getSheetMusicAssetUrl } from "@/lib/sheet-music-assets";
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

  // Tracks which conti the editor has already been seeded from, so an RSC
  // refresh (which hands us new conti/existingExport object references without
  // changing the underlying conti) does not rebuild the editor and clobber
  // in-progress edits.
  const seededContiIdRef = useRef<string | null>(null);

  const buildEditorPages = useCallback(
    async (savedLayouts: PageLayout[] | null): Promise<EditorPage[]> => {
      const editorPages: EditorPage[] = [];
      const arrangementItems = buildArrangementItems(conti.songs);
      const isLegacyLayout = (layout: PageLayout) =>
        layout.arrangementItemKey === undefined || layout.arrangementItemKey === null;

      const findSavedLayout = (
        arrangementItemKey: string,
        displayIndex: number,
        legacySongIndex: number,
        sheetMusicFileId: string | null,
        pdfPageIndex: number | null,
      ) => {
        const exact = savedLayouts?.find(
          (l) =>
            l.arrangementItemKey === arrangementItemKey &&
            l.sheetMusicFileId === sheetMusicFileId &&
            (l.pdfPageIndex ?? null) === pdfPageIndex,
        );
        if (exact) return exact;

        return savedLayouts?.find(
          (l) =>
            l.songIndex === legacySongIndex &&
            isLegacyLayout(l) &&
            l.sheetMusicFileId === sheetMusicFileId &&
            (l.pdfPageIndex ?? null) === pdfPageIndex,
        ) ?? savedLayouts?.find(
          (l) =>
            l.songIndex === displayIndex &&
            isLegacyLayout(l) &&
            l.sheetMusicFileId === sheetMusicFileId &&
            (l.pdfPageIndex ?? null) === pdfPageIndex,
        );
      };

      const findSavedLayoutByPageIndex = (
        displayIndex: number,
        legacySongIndex: number,
        sheetMusicFileId: string,
      ) =>
        savedLayouts?.find(
          (l) =>
            l.songIndex === legacySongIndex &&
            isLegacyLayout(l) &&
            l.sheetMusicFileId === sheetMusicFileId &&
            l.pageIndex === editorPages.length,
        ) ?? savedLayouts?.find(
          (l) =>
            l.songIndex === displayIndex &&
            isLegacyLayout(l) &&
            l.sheetMusicFileId === sheetMusicFileId &&
            l.pageIndex === editorPages.length,
        );

      for (let itemIndex = 0; itemIndex < arrangementItems.length; itemIndex++) {
        const item = arrangementItems[itemIndex];
        const contiSong = item.primarySong as typeof conti.songs[number];
        const legacySongIndex = conti.songs.findIndex((song) => song.id === contiSong.id);
        const sheetMusic = contiSong.sheetMusic;
        const pageBase = {
          songIndex: itemIndex,
          arrangementItemKey: item.key,
          displayIndex: itemIndex,
          primaryContiSongId: contiSong.id,
        };

        if (sheetMusic.length === 0) {
          const defaultOverlays = buildDefaultOverlays(
            itemIndex,
            item.sectionOrder,
            item.tempos,
          );
          const saved = findSavedLayout(item.key, itemIndex, legacySongIndex, null, null);
          editorPages.push({
            ...pageBase,
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
          const assetUrl = getSheetMusicAssetUrl(file);
          if (file.fileType.includes("image")) {
            const defaultOverlays = buildDefaultOverlays(
              itemIndex,
              item.sectionOrder,
              item.tempos,
            );
            const saved = findSavedLayout(item.key, itemIndex, legacySongIndex, file.id, null);
            const preset = findPresetPdfPageMetadata(
              contiSong.presetPdfMetadata,
              file.id,
              null,
            );
            editorPages.push({
              ...pageBase,
              sheetMusicFileId: file.id,
              imageUrl: assetUrl,
              pdfPageIndex: null,
              overlays:
                saved?.overlays ??
                mergePresetOverlays(
                  preset?.overlays,
                  itemIndex,
                  item.sectionOrder,
                  item.tempos,
                ) ??
                defaultOverlays,
              imageScale: saved?.imageScale ?? preset?.imageScale ?? 1,
              imageOffsetX: saved?.imageOffsetX ?? preset?.imageOffsetX ?? 0,
              imageOffsetY: saved?.imageOffsetY ?? preset?.imageOffsetY ?? 0,
              cropX: saved?.cropX ?? preset?.cropX ?? null,
              cropY: saved?.cropY ?? preset?.cropY ?? null,
              cropWidth: saved?.cropWidth ?? preset?.cropWidth ?? null,
              cropHeight: saved?.cropHeight ?? preset?.cropHeight ?? null,
              originalImageUrl:
                (saved?.cropX !== undefined ||
                  saved?.cropY !== undefined ||
                  saved?.cropWidth !== undefined ||
                  saved?.cropHeight !== undefined ||
                  preset?.cropX !== undefined ||
                  preset?.cropY !== undefined ||
                  preset?.cropWidth !== undefined ||
                  preset?.cropHeight !== undefined)
                  ? assetUrl
                  : null,
            });
          } else if (file.fileType.includes("pdf")) {
            try {
              const pageCount = await getPdfPageCount(assetUrl);
              for (let p = 0; p < pageCount; p++) {
                const defaultOverlays = buildDefaultOverlays(
                  itemIndex,
                  item.sectionOrder,
                  item.tempos,
                );
                const saved =
                  findSavedLayout(item.key, itemIndex, legacySongIndex, file.id, p) ??
                  findSavedLayoutByPageIndex(itemIndex, legacySongIndex, file.id);
                const preset = findPresetPdfPageMetadata(
                  contiSong.presetPdfMetadata,
                  file.id,
                  p,
                );
                editorPages.push({
                  ...pageBase,
                  sheetMusicFileId: file.id,
                  imageUrl: null,
                  pdfPageIndex: p,
                  overlays:
                    saved?.overlays ??
                    mergePresetOverlays(
                      preset?.overlays,
                      itemIndex,
                      item.sectionOrder,
                      item.tempos,
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
                itemIndex,
                item.sectionOrder,
                item.tempos,
              );
              const savedFallback = findSavedLayout(item.key, itemIndex, legacySongIndex, file.id, null);
              const presetFallback = findPresetPdfPageMetadata(
                contiSong.presetPdfMetadata,
                file.id,
                null,
              );
              editorPages.push({
                ...pageBase,
                sheetMusicFileId: file.id,
                imageUrl: null,
                pdfPageIndex: null,
                overlays:
                  savedFallback?.overlays ??
                  mergePresetOverlays(
                    presetFallback?.overlays,
                    itemIndex,
                    item.sectionOrder,
                    item.tempos,
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

      return editorPages;
    },
    [conti],
  );

  // Seed pages from conti data once per conti. Re-runs when conti/existingExport
  // change reference (e.g. an RSC refresh), but the seededContiIdRef guard skips
  // the rebuild unless the conti itself changed — the editor owns its layout
  // state after seeding, and rebuilding would discard in-progress edits. Use
  // reloadFromPreset for explicit rebuilds.
  useEffect(() => {
    if (seededContiIdRef.current === conti.id) return;
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

      const editorPages = await buildEditorPages(savedLayouts);

      if (!cancelled) {
        setPages(editorPages);
        setLoading(false);
        // Mark seeded only after a successful build so an interrupted initial
        // build cannot leave the editor stuck on the loading skeleton.
        seededContiIdRef.current = conti.id;
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [conti.id, buildEditorPages, existingExport]);

  const reloadFromPreset = useCallback(async () => {
    setLoading(true);
    const editorPages = await buildEditorPages(null);
    setPages(editorPages);
    setCurrentPageIndex(0);
    setLoading(false);
  }, [buildEditorPages]);

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
      let assetUrl: string | null = null;
      for (const cs of conti.songs) {
        for (const sm of cs.sheetMusic) {
          if (sm.id === page.sheetMusicFileId) {
            assetUrl = getSheetMusicAssetUrl(sm);
            break;
          }
        }
        if (assetUrl) break;
      }
      if (!assetUrl) {
        renderingPageRef.current.delete(currentPageIndex);
        return prev;
      }

      const pageIdx = currentPageIndex;
      renderPdfPageToDataUrl(assetUrl, page.pdfPageIndex + 1)
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
    reloadFromPreset,
  };
}
