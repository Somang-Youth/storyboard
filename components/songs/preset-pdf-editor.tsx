"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CropIcon,
  Delete01Icon,
  FloppyDiskIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import {
  useCropMode,
  useEditorPages,
  useImageTransform,
  useOverlays,
} from "@/components/contis/pdf-export/hooks";
import { extractPresetPdfMetadataFromLayout } from "@/lib/utils/pdf-export-helpers";
import type {
  ContiWithSongsAndSheetMusic,
  PageLayout,
  PresetPdfMetadata,
  SheetMusicFile,
} from "@/lib/types";

interface PresetPdfEditorProps {
  songName: string;
  sheetMusic: SheetMusicFile[];
  sectionOrder: string[];
  tempos: number[];
  initialMetadata: PresetPdfMetadata | null;
  onSave: (metadata: PresetPdfMetadata | null) => void;
}

export function PresetPdfEditor({
  songName,
  sheetMusic,
  sectionOrder,
  tempos,
  initialMetadata,
  onSave,
}: PresetPdfEditorProps) {
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved");
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualConti = useMemo<ContiWithSongsAndSheetMusic>(() => {
    const now = new Date();
    return {
      id: "preset-editor",
      title: "프리셋 PDF 편집",
      date: "1970-01-01",
      description: null,
      createdAt: now,
      updatedAt: now,
      songs: [
        {
          id: "preset-editor-song",
          contiId: "preset-editor",
          songId: "preset-editor-song",
          sortOrder: 0,
          keys: null,
          tempos: null,
          sectionOrder: null,
          lyrics: null,
          sectionLyricsMap: null,
          notes: null,
          sheetMusicFileIds: null,
          presetId: "preset-editor",
          createdAt: now,
          updatedAt: now,
          song: {
            id: "preset-editor-song",
            name: songName,
            createdAt: now,
            updatedAt: now,
          },
          overrides: {
            keys: [],
            tempos,
            sectionOrder,
            lyrics: [],
            sectionLyricsMap: {},
            notes: null,
            sheetMusicFileIds: null,
            presetId: "preset-editor",
          },
          sheetMusic,
          presetPdfMetadata: initialMetadata,
        },
      ],
    };
  }, [songName, tempos, sectionOrder, sheetMusic, initialMetadata]);

  const {
    pages,
    setPages,
    currentPage,
    currentPageIndex,
    setCurrentPageIndex,
    loading,
  } = useEditorPages(virtualConti, null);

  const triggerDirty = () => setSaveStatus("unsaved");

  const {
    isCropMode,
    setIsCropMode,
    cropSelection,
    setCropSelection,
    isCropDragging,
    enterCropMode,
    handleCropPointerDown,
    handleCropPointerMove,
    handleCropPointerUp,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
    handleCropConfirm,
    handleUndoCrop,
    handleCancelCropMode,
    handleCropCancel,
  } = useCropMode(
    pages,
    setPages,
    currentPageIndex,
    containerRef,
    triggerDirty,
  );

  const {
    selectedOverlayId,
    setSelectedOverlayId,
    draggingId,
    updateOverlay,
    addCustomOverlay,
    deleteOverlay,
    resetOverlaysToDefault,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useOverlays(
    pages,
    setPages,
    currentPageIndex,
    containerRef,
    triggerDirty,
  );

  const {
    isPanningImage,
    setImageResizeHandle,
    imageSelected,
    setImageSelected,
    imgNaturalSizeRef,
    getImageBounds,
    handleContainerPointerDown,
    handleContainerPointerMove,
    handleContainerPointerUp,
    handleImageResizeDown,
    handleImageResizeMove,
    handleImageResizeUp,
    resetImageTransform,
  } = useImageTransform(
    pages,
    setPages,
    currentPageIndex,
    containerRef,
    triggerDirty,
    isCropMode,
    setSelectedOverlayId,
  );

  function handleSaveMetadata() {
    const pageLayouts: PageLayout[] = pages.map((page, index) => ({
      pageIndex: index,
      songIndex: page.songIndex,
      sheetMusicFileId: page.sheetMusicFileId,
      pdfPageIndex: page.pdfPageIndex,
      overlays: page.overlays,
      imageScale: page.imageScale,
      imageOffsetX: page.imageOffsetX,
      imageOffsetY: page.imageOffsetY,
      cropX: page.cropX ?? undefined,
      cropY: page.cropY ?? undefined,
      cropWidth: page.cropWidth ?? undefined,
      cropHeight: page.cropHeight ?? undefined,
      originalImageUrl:
        page.originalImageUrl && !page.originalImageUrl.startsWith("data:")
          ? page.originalImageUrl
          : undefined,
    }));

    const metadata = extractPresetPdfMetadataFromLayout(pageLayouts, 0);
    onSave(metadata);
    setSaveStatus("saved");
    toast.success("프리셋 PDF 메타데이터가 저장되었습니다");
  }

  function goToPrevPage() {
    setSelectedOverlayId(null);
    setImageSelected(false);
    setIsCropMode(false);
    setCropSelection(null);
    setCurrentPageIndex((i) => Math.max(0, i - 1));
  }

  function goToNextPage() {
    setSelectedOverlayId(null);
    setImageSelected(false);
    setIsCropMode(false);
    setCropSelection(null);
    setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
        <div className="aspect-[1/1.414] w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <p className="text-muted-foreground text-base">
          표시할 악보가 없습니다. 악보를 먼저 선택해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 pb-2">
      <div className="p-2 overflow-x-auto">
        <div className="flex min-w-max items-center gap-2" data-toolbar>
          <span className="text-sm font-semibold pr-2">
            프리셋 PDF 편집
          </span>
          <span className="text-sm font-medium text-muted-foreground pr-2">
            {songName}
          </span>
          <span className="text-sm text-muted-foreground">
            {saveStatus === "saved" ? "저장됨" : "저장되지 않음"}
          </span>
          <Button variant="outline" size="sm" onClick={handleSaveMetadata}>
            <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} data-icon="inline-start" />
            프리셋에 저장
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevPage}
            disabled={currentPageIndex === 0}
          >
            <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums px-1">
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

          {currentPage.imageUrl && (
            <>
              <span className="text-sm tabular-nums text-muted-foreground pl-2">
                {currentPage.imageScale.toFixed(1)}x
              </span>
              <Button variant="outline" size="sm" onClick={resetImageTransform}>
                악보 초기화
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetOverlaysToDefault(0, sectionOrder, tempos)}
              >
                텍스트 초기화
              </Button>
              {!isCropMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    enterCropMode(() => {
                      setImageResizeHandle(null);
                      setImageSelected(false);
                    })
                  }
                >
                  <HugeiconsIcon icon={CropIcon} strokeWidth={2} data-icon="inline-start" />
                  자르기
                </Button>
              )}
              {isCropMode && (
                <Button variant="outline" size="sm" onClick={handleCancelCropMode}>
                  자르기 취소
                </Button>
              )}
              {currentPage.originalImageUrl && (
                <Button variant="outline" size="sm" onClick={handleUndoCrop}>
                  자르기 복원
                </Button>
              )}
            </>
          )}

          <Button variant="outline" size="sm" onClick={addCustomOverlay}>
            <HugeiconsIcon icon={TextFontIcon} strokeWidth={2} data-icon="inline-start" />
            텍스트 추가
          </Button>

          {isCropMode && cropSelection && !isCropDragging && (
            <>
              <Button size="sm" onClick={handleCropConfirm}>
                자르기 확인
              </Button>
              <Button size="sm" variant="outline" onClick={handleCropCancel}>
                취소
              </Button>
            </>
          )}

          {selectedOverlayId && (() => {
            const overlay = currentPage.overlays.find((o) => o.id === selectedOverlayId);
            if (!overlay) return null;
            return (
              <>
                <span className="text-sm text-muted-foreground pl-2">글꼴 크기</span>
                <input
                  type="number"
                  min={8}
                  max={72}
                  step={1}
                  value={overlay.fontSize}
                  onChange={(e) =>
                    updateOverlay(selectedOverlayId, {
                      fontSize: parseInt(e.target.value, 10) || 14,
                    })
                  }
                  className="w-16 rounded border px-2 py-1 text-sm"
                />
                <span className="text-sm text-muted-foreground">색상</span>
                <input
                  type="color"
                  value={overlay.color ?? "#000000"}
                  onChange={(e) => updateOverlay(selectedOverlayId, { color: e.target.value })}
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                {overlay.type === "custom" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteOverlay(selectedOverlayId)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} data-icon="inline-start" />
                    삭제
                  </Button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div className="min-h-0">
        <div
          ref={containerRef}
          className={`relative aspect-[1/1.414] w-full max-w-2xl mx-auto border rounded-lg bg-white ${isPanningImage ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
        >
        <div className="absolute inset-0 overflow-hidden">
          {currentPage.imageUrl ? (
            <img
              src={currentPage.imageUrl}
              alt={`악보 - ${songName}`}
              className="absolute pointer-events-none"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transformOrigin: "0 0",
                transform: `scale(${currentPage.imageScale}) translate(${currentPage.imageOffsetX / currentPage.imageScale}%, ${currentPage.imageOffsetY / currentPage.imageScale}%)`,
              }}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                imgNaturalSizeRef.current = {
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                };
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {currentPage.pdfPageIndex !== null ? "PDF 페이지 로딩 중..." : songName}
            </div>
          )}

          {isCropMode && currentPage.imageUrl && (
            <>
              <div
                className="absolute inset-0 z-10"
                style={{
                  backgroundColor:
                    cropSelection === null ? "rgba(0, 0, 0, 0.4)" : "transparent",
                  cursor: "crosshair",
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
                      boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.4)",
                      backgroundColor: "transparent",
                    }}
                  />
                  {(["tl", "tr", "bl", "br"] as const).map((corner) => {
                    const isLeft = corner === "tl" || corner === "bl";
                    const isTop = corner === "tl" || corner === "tr";
                    return (
                      <div
                        key={corner}
                        className="absolute z-20 w-5 h-5 bg-white border-2 border-blue-500 rounded-sm"
                        style={{
                          left: `${isLeft ? Math.min(cropSelection.startX, cropSelection.endX) : Math.max(cropSelection.startX, cropSelection.endX)}%`,
                          top: `${isTop ? Math.min(cropSelection.startY, cropSelection.endY) : Math.max(cropSelection.startY, cropSelection.endY)}%`,
                          transform: "translate(-50%, -50%)",
                          cursor:
                            corner === "tl" || corner === "br"
                              ? "nwse-resize"
                              : "nesw-resize",
                        }}
                        onPointerDown={(e) => handleResizePointerDown(e, corner)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                      />
                    );
                  })}
                </>
              )}
            </>
          )}

          {currentPage.overlays.map((overlay) => (
            <div
              key={overlay.id}
              data-overlay
              className={`absolute cursor-move select-none px-1.5 py-0.5 rounded transition-colors ${
                draggingId === overlay.id
                  ? "border-2 border-blue-500 bg-blue-50/80"
                  : selectedOverlayId === overlay.id
                    ? "border-2 border-blue-400 bg-blue-50/50"
                    : "border border-transparent hover:border-gray-300 hover:bg-white/80"
              }`}
              style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                fontSize: `${overlay.fontSize}px`,
                fontWeight:
                  overlay.type === "songNumber"
                    ? 700
                    : overlay.type === "custom"
                      ? 400
                      : 600,
                color: overlay.color ?? "#000000",
                transform:
                  overlay.type === "bpm"
                    ? "translateX(-100%)"
                    : overlay.type === "sectionOrder"
                      ? "translateX(-50%)"
                      : "none",
                whiteSpace: "pre-wrap",
                fontFamily:
                  '"Pretendard Variable", Pretendard, -apple-system, sans-serif',
              }}
              onPointerDown={(e) => handlePointerDown(e, overlay.id)}
              onPointerMove={(e) => handlePointerMove(e, overlay.id)}
              onPointerUp={(e) => handlePointerUp(e, overlay.id)}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                className="outline-none"
                onBlur={(e) => {
                  const newText = (e.target as HTMLElement).innerText ?? overlay.text;
                  if (newText !== overlay.text) {
                    updateOverlay(overlay.id, { text: newText });
                  }
                }}
              >
                {overlay.text}
              </span>
            </div>
          ))}
        </div>

        {currentPage.imageUrl && !isCropMode && imageSelected && (() => {
          const bounds = getImageBounds(currentPage);
          return (
            <>
              <div
                className="absolute z-10 pointer-events-none border-2 border-blue-500 rounded-sm"
                style={{
                  left: `${bounds.left}%`,
                  top: `${bounds.top}%`,
                  width: `${bounds.right - bounds.left}%`,
                  height: `${bounds.bottom - bounds.top}%`,
                }}
              />
              {(["tl", "tr", "bl", "br"] as const).map((corner) => {
                const isLeft = corner === "tl" || corner === "bl";
                const isTop = corner === "tl" || corner === "tr";
                return (
                  <div
                    key={`resize-${corner}`}
                    className="absolute z-10 w-4 h-4 bg-white border-2 border-blue-500 rounded-sm"
                    style={{
                      left: `${isLeft ? bounds.left : bounds.right}%`,
                      top: `${isTop ? bounds.top : bounds.bottom}%`,
                      transform: "translate(-50%, -50%)",
                      cursor:
                        corner === "tl" || corner === "br"
                          ? "nwse-resize"
                          : "nesw-resize",
                    }}
                    onPointerDown={(e) => handleImageResizeDown(e, corner)}
                    onPointerMove={handleImageResizeMove}
                    onPointerUp={handleImageResizeUp}
                  />
                );
              })}
            </>
          );
        })()}
        </div>
      </div>

    </div>
  );
}
