import { useState } from "react";
import { toast } from "sonner";
import type { EditorPage, CropSelection } from "../types";

type CropResizeHandle =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "top"
  | "right"
  | "bottom"
  | "left";

export function useCropMode(
  pages: EditorPage[],
  setPages: React.Dispatch<React.SetStateAction<EditorPage[]>>,
  currentPageIndex: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
  triggerAutoSave: () => void,
) {
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(
    null,
  );
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [cropResizing, setCropResizing] = useState<CropResizeHandle | null>(
    null,
  );

  // Composite function to enter crop mode from the component
  function enterCropMode(cleanupImageTransform: () => void) {
    setIsCropMode(true);
    setCropSelection(null);
    setIsCropDragging(false);
    cleanupImageTransform();
  }

  function handleCropPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setCropSelection({ startX: x, startY: y, endX: x, endY: y });
    setIsCropDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleCropPointerMove(e: React.PointerEvent) {
    if (!isCropDragging) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
    );

    setCropSelection((prev) => (prev ? { ...prev, endX: x, endY: y } : null));
  }

  function handleCropPointerUp() {
    setIsCropDragging(false);
    if (cropSelection) {
      const w = Math.abs(cropSelection.endX - cropSelection.startX);
      const h = Math.abs(cropSelection.endY - cropSelection.startY);
      if (w < 2 || h < 2) {
        setCropSelection(null);
      }
    }
  }

  function handleCropCancel() {
    setCropSelection(null);
  }

  function handleResizePointerDown(
    e: React.PointerEvent,
    handle: CropResizeHandle,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setCropResizing(handle);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleResizePointerMove(e: React.PointerEvent) {
    if (!cropResizing || !cropSelection) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
    );

    const left = Math.min(cropSelection.startX, cropSelection.endX);
    const top = Math.min(cropSelection.startY, cropSelection.endY);
    const right = Math.max(cropSelection.startX, cropSelection.endX);
    const bottom = Math.max(cropSelection.startY, cropSelection.endY);

    let newLeft = left,
      newTop = top,
      newRight = right,
      newBottom = bottom;

    // Corner handles
    if (cropResizing === "tl") {
      newLeft = Math.min(x, right - 2);
      newTop = Math.min(y, bottom - 2);
    } else if (cropResizing === "tr") {
      newRight = Math.max(x, left + 2);
      newTop = Math.min(y, bottom - 2);
    } else if (cropResizing === "bl") {
      newLeft = Math.min(x, right - 2);
      newBottom = Math.max(y, top + 2);
    } else if (cropResizing === "br") {
      newRight = Math.max(x, left + 2);
      newBottom = Math.max(y, top + 2);
    }
    // Edge handles
    else if (cropResizing === "top") {
      newTop = Math.min(y, bottom - 2);
    } else if (cropResizing === "bottom") {
      newBottom = Math.max(y, top + 2);
    } else if (cropResizing === "left") {
      newLeft = Math.min(x, right - 2);
    } else if (cropResizing === "right") {
      newRight = Math.max(x, left + 2);
    }

    setCropSelection({
      startX: newLeft,
      startY: newTop,
      endX: newRight,
      endY: newBottom,
    });
  }

  function handleResizePointerUp() {
    setCropResizing(null);
  }

  async function handleCropConfirm() {
    const currentPage = pages[currentPageIndex];
    if (!cropSelection || !currentPage?.imageUrl) return;

    const container = containerRef.current;
    if (!container) return;

    const selLeft = Math.min(cropSelection.startX, cropSelection.endX) / 100;
    const selTop = Math.min(cropSelection.startY, cropSelection.endY) / 100;
    const selWidth = Math.abs(cropSelection.endX - cropSelection.startX) / 100;
    const selHeight = Math.abs(cropSelection.endY - cropSelection.startY) / 100;

    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = currentPage.imageUrl!;
    });

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const imageAspect = naturalW / naturalH;
    const containerAspect = containerW / containerH;

    let renderedW: number,
      renderedH: number,
      renderedX: number,
      renderedY: number;

    if (imageAspect > containerAspect) {
      renderedW = containerW;
      renderedH = containerW / imageAspect;
      renderedX = 0;
      renderedY = (containerH - renderedH) / 2;
    } else {
      renderedH = containerH;
      renderedW = containerH * imageAspect;
      renderedX = (containerW - renderedW) / 2;
      renderedY = 0;
    }

    const scale = currentPage.imageScale;
    const offXPx = (currentPage.imageOffsetX / 100) * containerW;
    const offYPx = (currentPage.imageOffsetY / 100) * containerH;

    const actualX = renderedX * scale + offXPx;
    const actualY = renderedY * scale + offYPx;
    const actualW = renderedW * scale;
    const actualH = renderedH * scale;

    const selLeftPx = selLeft * containerW;
    const selTopPx = selTop * containerH;
    const selWidthPx = selWidth * containerW;
    const selHeightPx = selHeight * containerH;

    const cropNatX = ((selLeftPx - actualX) / actualW) * naturalW;
    const cropNatY = ((selTopPx - actualY) / actualH) * naturalH;
    const cropNatW = (selWidthPx / actualW) * naturalW;
    const cropNatH = (selHeightPx / actualH) * naturalH;

    const sx = Math.max(0, Math.round(cropNatX));
    const sy = Math.max(0, Math.round(cropNatY));
    const sw = Math.min(naturalW - sx, Math.round(cropNatW));
    const sh = Math.min(naturalH - sy, Math.round(cropNatH));

    if (sw <= 0 || sh <= 0) {
      toast.error("선택 영역이 이미지 범위를 벗어났습니다");
      setCropSelection(null);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const croppedDataUrl = canvas.toDataURL("image/png");

    // Compute normalized crop coordinates relative to the ORIGINAL image
    let normCropX: number,
      normCropY: number,
      normCropW: number,
      normCropH: number;

    if (
      currentPage.cropX !== null &&
      currentPage.cropY !== null &&
      currentPage.cropWidth !== null &&
      currentPage.cropHeight !== null
    ) {
      // Re-crop: compose with existing crop coordinates
      normCropX = currentPage.cropX + (sx / naturalW) * currentPage.cropWidth;
      normCropY = currentPage.cropY + (sy / naturalH) * currentPage.cropHeight;
      normCropW = (sw / naturalW) * currentPage.cropWidth;
      normCropH = (sh / naturalH) * currentPage.cropHeight;
    } else {
      normCropX = sx / naturalW;
      normCropY = sy / naturalH;
      normCropW = sw / naturalW;
      normCropH = sh / naturalH;
    }

    const originalUrl = currentPage.originalImageUrl ?? currentPage.imageUrl;

    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
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
        };
      }),
    );

    setIsCropMode(false);
    setCropSelection(null);
    triggerAutoSave();
  }

  function handleUndoCrop() {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
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
        };
      }),
    );
    setIsCropMode(false);
    setCropSelection(null);
    triggerAutoSave();
  }

  function handleCancelCropMode() {
    setIsCropMode(false);
    setCropSelection(null);
    setIsCropDragging(false);
  }

  return {
    isCropMode,
    setIsCropMode,
    cropSelection,
    setCropSelection,
    isCropDragging,
    cropResizing,
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
  };
}
