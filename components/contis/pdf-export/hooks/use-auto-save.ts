import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { saveContiPdfLayout } from "@/lib/actions/conti-pdf-exports";
import { syncPresetPdfMetadataFromContiLayout } from "@/lib/actions/conti-songs";
import type { PdfLayoutState } from "@/lib/types";
import type { EditorPage } from "../types";

export function useAutoSave(
  pages: EditorPage[],
  contiId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const performSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const lastSaveRef = useRef<number>(0);

  const buildLayoutState = useCallback((): PdfLayoutState => {
    return {
      pages: pages.map((p, i) => ({
        pageIndex: i,
        songIndex: p.songIndex,
        sheetMusicFileId: p.sheetMusicFileId,
        pdfPageIndex: p.pdfPageIndex,
        overlays: p.overlays,
        imageScale: p.imageScale !== 1 ? p.imageScale : undefined,
        imageOffsetX: p.imageOffsetX !== 0 ? p.imageOffsetX : undefined,
        imageOffsetY: p.imageOffsetY !== 0 ? p.imageOffsetY : undefined,
        cropX: p.cropX ?? undefined,
        cropY: p.cropY ?? undefined,
        cropWidth: p.cropWidth ?? undefined,
        cropHeight: p.cropHeight ?? undefined,
        originalImageUrl:
          p.originalImageUrl && !p.originalImageUrl.startsWith("data:")
            ? p.originalImageUrl
            : undefined,
      })),
      canvasWidth: containerRef.current?.clientWidth ?? 800,
      canvasHeight: containerRef.current?.clientHeight ?? 1131,
    };
  }, [pages, containerRef]);

  const persistLayout = useCallback(
    async (layoutState: PdfLayoutState): Promise<boolean> => {
      setSaveStatus("saving");
      const result = await saveContiPdfLayout(
        contiId,
        JSON.stringify(layoutState),
      );
      if (result.success) {
        setSaveStatus("saved");
        lastSaveRef.current = Date.now();
        return true;
      }

      setSaveStatus("unsaved");
      toast.error(result.error ?? "저장 중 오류가 발생했습니다");
      return false;
    },
    [contiId],
  );

  // MUST be useCallback with [pages, contiId] to ensure latest state
  const performSave = useCallback(async () => {
    const layoutState = buildLayoutState();
    await persistLayout(layoutState);
  }, [buildLayoutState, persistLayout]);

  // CRITICAL: Sync ref so triggerAutoSave always calls latest performSave
  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  const triggerAutoSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    // Force save if 30s elapsed since last save (continuous editing)
    if (Date.now() - lastSaveRef.current > 30000) {
      performSaveRef.current();
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      performSaveRef.current();
    }, 3000);
  }, []);

  // Manual save handler
  async function handleManualSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const layoutState = buildLayoutState();
    const saved = await persistLayout(layoutState);
    if (!saved) return;

    const layoutStateText = JSON.stringify(layoutState);
    const syncResult = await syncPresetPdfMetadataFromContiLayout(
      contiId,
      layoutStateText,
    );

    if (!syncResult.success) {
      toast.warning(syncResult.error ?? "프리셋 동기화 중 오류가 발생했습니다");
      return;
    }

    const updatedPresetCount = syncResult.data?.updatedPresetCount ?? 0;
    if (updatedPresetCount > 0) {
      toast.success(`레이아웃과 프리셋 ${updatedPresetCount}개가 저장되었습니다`);
      return;
    }

    toast.success("레이아웃이 저장되었습니다");
  }

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === "unsaved") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  return {
    saveStatus,
    triggerAutoSave,
    performSave,
    handleManualSave,
  };
}
