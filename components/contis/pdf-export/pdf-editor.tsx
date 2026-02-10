"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSidebarHeader } from "@/components/layout/sidebar-header-context";
import { HugeiconsIcon } from "@hugeicons/react";
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
} from "@hugeicons/core-free-icons";
import { formatDate } from "./utils";
import type { PdfEditorProps } from "./types";
import {
  useEditorPages,
  useAutoSave,
  useOverlays,
  useImageTransform,
  useCropMode,
  usePdfExport,
} from "./hooks";

export function PdfEditor({ conti, existingExport }: PdfEditorProps) {
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const { setHeaderContent } = useSidebarHeader();

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Page state (no hook dependencies)
  const { pages, setPages, currentPageIndex, setCurrentPageIndex, loading, currentPage } =
    useEditorPages(conti, existingExport);

  // 2. Auto-save (depends on: pages, contiId, containerRef)
  const { saveStatus, triggerAutoSave, performSave, handleManualSave } =
    useAutoSave(pages, conti.id, containerRef);

  // 3. Crop mode (depends on: pages, setPages, currentPageIndex, containerRef, triggerAutoSave)
  const {
    isCropMode, setIsCropMode, cropSelection, setCropSelection,
    isCropDragging,
    enterCropMode,
    handleCropPointerDown, handleCropPointerMove, handleCropPointerUp,
    handleResizePointerDown, handleResizePointerMove, handleResizePointerUp,
    handleCropConfirm, handleUndoCrop, handleCancelCropMode, handleCropCancel,
  } = useCropMode(pages, setPages, currentPageIndex, containerRef, triggerAutoSave);

  // 4. Overlays (depends on: pages, setPages, currentPageIndex, containerRef, triggerAutoSave)
  const {
    selectedOverlayId, setSelectedOverlayId, draggingId,
    updateOverlay, addCustomOverlay, deleteOverlay, resetOverlaysToDefault,
    handlePointerDown, handlePointerMove, handlePointerUp,
  } = useOverlays(pages, setPages, currentPageIndex, containerRef, triggerAutoSave);

  // 5. Image transform (depends on: isCropMode from useCropMode, setSelectedOverlayId from useOverlays)
  const {
    isPanningImage, setImageResizeHandle, imageSelected, setImageSelected,
    imgNaturalSizeRef, getImageBounds,
    handleContainerPointerDown, handleContainerPointerMove, handleContainerPointerUp,
    handleImageResizeDown, handleImageResizeMove, handleImageResizeUp,
    resetImageTransform,
  } = useImageTransform(pages, setPages, currentPageIndex, containerRef, triggerAutoSave, isCropMode, setSelectedOverlayId);

  // 6. PDF export (depends on: pages, performSave, containerRef)
  const { exporting, pdfUrl, handleExport } =
    usePdfExport(pages, conti, existingExport, containerRef, performSave);

  // Inject custom sidebar header
  useEffect(() => {
    setHeaderContent(
      <div className="flex items-start gap-2">
        <Link
          href={`/contis/${conti.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            className="size-6 mt-0.5"
          />
        </Link>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">PDF 내보내기</h2>
          <p className="text-sm text-muted-foreground truncate">
            {conti.title || formatDate(conti.date)}
          </p>
        </div>
      </div>,
    );
    return () => setHeaderContent(null);
  }, [conti.id, conti.title, conti.date, setHeaderContent]);

  // Navigation
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

  // Mobile guard
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground text-xl">
          이 기능은 PC에서 사용해주세요
        </p>
        <Link
          href={`/contis/${conti.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            className="size-8"
          />
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
        <div className="aspect-[1/1.414] w-full max-w-3xl mx-auto bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  const songName = currentPage
    ? (conti.songs[currentPage.songIndex]?.song.name ?? "")
    : "";

  return (
    <div className="flex flex-col gap-4">
      {/* Consolidated Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Song name */}
        <span className="text-base font-medium text-muted-foreground truncate min-w-0">
          {songName}
        </span>

        {/* Center: Image tools */}
        <div className="flex items-center gap-2 shrink-0">
          {currentPage?.imageUrl && (
            <>
              <span className="text-sm tabular-nums text-muted-foreground">
                {currentPage.imageScale.toFixed(1)}x
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetImageTransform}
                disabled={
                  currentPage.imageScale === 1 &&
                  currentPage.imageOffsetX === 0 &&
                  currentPage.imageOffsetY === 0
                }
              >
                악보 초기화
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!currentPage) return;
                  const contiSong = conti.songs[currentPage.songIndex];
                  if (contiSong) {
                    resetOverlaysToDefault(
                      currentPage.songIndex,
                      contiSong.overrides.sectionOrder,
                      contiSong.overrides.tempos,
                    );
                  }
                }}
              >
                텍스트 초기화
              </Button>
              {!isCropMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => enterCropMode(() => {
                    setImageResizeHandle(null);
                    setImageSelected(false);
                  })}
                  disabled={!currentPage.imageUrl}
                >
                  <HugeiconsIcon
                    icon={CropIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
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
                <Button variant="outline" size="sm" onClick={handleUndoCrop}>
                  자르기 복원
                </Button>
              )}
            </>
          )}
          <Button variant="outline" size="sm" onClick={addCustomOverlay}>
            <HugeiconsIcon
              icon={TextFontIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            텍스트 추가
          </Button>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-muted-foreground text-sm">
            {saveStatus === "saved" && "저장됨"}
            {saveStatus === "saving" && "저장 중..."}
            {saveStatus === "unsaved" && "저장되지 않음"}
          </span>
          <Button variant="outline" size="sm" onClick={handleManualSave}>
            <HugeiconsIcon
              icon={FloppyDiskIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            저장
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || pages.length === 0}
          >
            <HugeiconsIcon
              icon={FileExportIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {exporting ? "생성 중..." : "PDF 내보내기"}
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
              <HugeiconsIcon
                icon={Download04Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              다운로드
            </Button>
          )}
        </div>
      </div>

      {/* Crop confirm/cancel toolbar */}
      {isCropMode && cropSelection && !isCropDragging && (
        <div className="flex items-center justify-center gap-3">
          <span className="text-base text-muted-foreground">
            선택 영역을 조절한 후
          </span>
          <Button size="sm" onClick={handleCropConfirm}>
            자르기 확인
          </Button>
          <Button size="sm" variant="outline" onClick={handleCropCancel}>
            취소
          </Button>
        </div>
      )}

      {/* Overlay edit toolbar */}
      {selectedOverlayId && currentPage && (() => {
        const overlay = currentPage.overlays.find((o) => o.id === selectedOverlayId);
        if (!overlay) return null;
        const typeLabel =
          overlay.type === "songNumber"
            ? "곡 번호"
            : overlay.type === "sectionOrder"
              ? "섹션 순서"
              : overlay.type === "bpm"
                ? "BPM"
                : "텍스트";
        return (
          <div className="flex items-center justify-center gap-3" data-toolbar>
            <span className="text-base font-medium">{typeLabel}</span>
            <span className="text-base text-muted-foreground">글꼴 크기</span>
            <input
              type="number"
              min={8}
              max={72}
              step={1}
              value={overlay.fontSize}
              onChange={(e) =>
                updateOverlay(selectedOverlayId, {
                  fontSize: parseInt(e.target.value) || 14,
                })
              }
              className="w-16 rounded border px-2 py-1 text-base"
            />
            <span className="text-base text-muted-foreground">글꼴 색상</span>
            <input
              type="color"
              value={overlay.color ?? "#000000"}
              onChange={(e) =>
                updateOverlay(selectedOverlayId, { color: e.target.value })
              }
              className="h-8 w-8 rounded border cursor-pointer"
            />
            {overlay.type === "custom" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteOverlay(selectedOverlayId)}
              >
                <HugeiconsIcon
                  icon={Delete01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                삭제
              </Button>
            )}
          </div>
        );
      })()}

      {/* Canvas Area */}
      {currentPage && (
        <div
          ref={containerRef}
          className={`relative aspect-[1/1.414] w-full max-w-2xl mx-auto border rounded-lg bg-white ${isPanningImage ? "cursor-grabbing" : "cursor-grab"}`}
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
                {currentPage.pdfPageIndex !== null
                  ? "PDF 페이지 로딩 중..."
                  : songName}
              </div>
            )}

            {/* Crop mode overlay */}
            {isCropMode && currentPage?.imageUrl && (
              <>
                <div
                  className="absolute inset-0 z-10"
                  style={{
                    backgroundColor:
                      cropSelection === null
                        ? "rgba(0, 0, 0, 0.4)"
                        : "transparent",
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
                    {/* Corner handles */}
                    {(["tl", "tr", "bl", "br"] as const).map((corner) => {
                      const isLeft = corner === "tl" || corner === "bl";
                      const isTop = corner === "tl" || corner === "tr";
                      return (
                        <div
                          key={corner}
                          className="absolute z-20 w-5 h-5 bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize"
                          style={{
                            left: `${isLeft ? Math.min(cropSelection.startX, cropSelection.endX) : Math.max(cropSelection.startX, cropSelection.endX)}%`,
                            top: `${isTop ? Math.min(cropSelection.startY, cropSelection.endY) : Math.max(cropSelection.startY, cropSelection.endY)}%`,
                            transform: "translate(-50%, -50%)",
                            cursor:
                              corner === "tl" || corner === "br"
                                ? "nwse-resize"
                                : "nesw-resize",
                          }}
                          onPointerDown={(e) =>
                            handleResizePointerDown(e, corner)
                          }
                          onPointerMove={handleResizePointerMove}
                          onPointerUp={handleResizePointerUp}
                        />
                      );
                    })}
                    {/* Edge handles */}
                    {(["top", "right", "bottom", "left"] as const).map(
                      (edge) => {
                        const left = Math.min(
                          cropSelection.startX,
                          cropSelection.endX,
                        );
                        const top = Math.min(
                          cropSelection.startY,
                          cropSelection.endY,
                        );
                        const right = Math.max(
                          cropSelection.startX,
                          cropSelection.endX,
                        );
                        const bottom = Math.max(
                          cropSelection.startY,
                          cropSelection.endY,
                        );
                        const midX = (left + right) / 2;
                        const midY = (top + bottom) / 2;

                        const pos =
                          edge === "top"
                            ? { left: midX, top: top }
                            : edge === "right"
                              ? { left: right, top: midY }
                              : edge === "bottom"
                                ? { left: midX, top: bottom }
                                : { left: left, top: midY };

                        return (
                          <div
                            key={edge}
                            className="absolute z-20 bg-white border-2 border-blue-500 rounded-sm"
                            style={{
                              left: `${pos.left}%`,
                              top: `${pos.top}%`,
                              width:
                                edge === "top" || edge === "bottom"
                                  ? "12px"
                                  : "6px",
                              height:
                                edge === "top" || edge === "bottom"
                                  ? "6px"
                                  : "12px",
                              transform: "translate(-50%, -50%)",
                              cursor:
                                edge === "top" || edge === "bottom"
                                  ? "ns-resize"
                                  : "ew-resize",
                            }}
                            onPointerDown={(e) =>
                              handleResizePointerDown(e, edge)
                            }
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                          />
                        );
                      },
                    )}
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
                  whiteSpace: "nowrap",
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
                    const newText =
                      (e.target as HTMLElement).textContent ?? overlay.text;
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
          {/* Image selection border + resize corner handles - OUTSIDE the clipping div */}
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
            <p className="text-muted-foreground text-base mt-3">
              잠시만 기다려주세요
            </p>
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
  );
}
