import { useState, useRef } from "react";
import type { EditorPage } from "../types";

export function useImageTransform(
  pages: EditorPage[],
  setPages: React.Dispatch<React.SetStateAction<EditorPage[]>>,
  currentPageIndex: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
  triggerAutoSave: () => void,
  isCropMode: boolean,
  setSelectedOverlayId: (id: string | null) => void,
) {
  const [isPanningImage, setIsPanningImage] = useState(false);
  const [imageResizeHandle, setImageResizeHandle] = useState<
    "tl" | "tr" | "bl" | "br" | null
  >(null);
  const [imageSelected, setImageSelected] = useState(false);

  const panStartRef = useRef<{
    x: number;
    y: number;
    offX: number;
    offY: number;
  }>({ x: 0, y: 0, offX: 0, offY: 0 });
  const resizeStartRef = useRef<{
    x: number;
    y: number;
    scale: number;
    offX: number;
    offY: number;
    containerW: number;
    containerH: number;
    imgStartX: number;
    imgStartY: number;
    imgSizeX: number;
    imgSizeY: number;
  }>({
    x: 0,
    y: 0,
    scale: 1,
    offX: 0,
    offY: 0,
    containerW: 0,
    containerH: 0,
    imgStartX: 0,
    imgStartY: 0,
    imgSizeX: 100,
    imgSizeY: 100,
  });
  const imgNaturalSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );

  function updateImageTransform(
    updates: Partial<{
      imageScale: number;
      imageOffsetX: number;
      imageOffsetY: number;
    }>,
  ) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return { ...page, ...updates };
      }),
    );
    triggerAutoSave();
  }

  function updateImageTransformSilent(
    updates: Partial<{
      imageScale: number;
      imageOffsetX: number;
      imageOffsetY: number;
    }>,
  ) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return { ...page, ...updates };
      }),
    );
  }

  function resetImageTransform() {
    updateImageTransform({
      imageScale: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
    });
  }

  function getContainBounds(): {
    startX: number;
    startY: number;
    sizeX: number;
    sizeY: number;
  } {
    const container = containerRef.current;
    const nat = imgNaturalSizeRef.current;
    if (!container || !nat || nat.width === 0 || nat.height === 0) {
      return { startX: 0, startY: 0, sizeX: 100, sizeY: 100 };
    }
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const imgAspect = nat.width / nat.height;
    const containerAspect = cW / cH;
    if (imgAspect > containerAspect) {
      const sizeYPct = (cW / imgAspect / cH) * 100;
      return {
        startX: 0,
        startY: (100 - sizeYPct) / 2,
        sizeX: 100,
        sizeY: sizeYPct,
      };
    } else {
      const sizeXPct = ((cH * imgAspect) / cW) * 100;
      return {
        startX: (100 - sizeXPct) / 2,
        startY: 0,
        sizeX: sizeXPct,
        sizeY: 100,
      };
    }
  }

  function getImageBounds(page: EditorPage) {
    const s = page.imageScale;
    const offX = page.imageOffsetX;
    const offY = page.imageOffsetY;
    const c = getContainBounds();
    return {
      left: s * c.startX + offX,
      top: s * c.startY + offY,
      right: s * (c.startX + c.sizeX) + offX,
      bottom: s * (c.startY + c.sizeY) + offY,
    };
  }

  // Container-level pointer handlers for image panning
  function handleContainerPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement;
    // Clear selection on background click (not overlay, not toolbar)
    if (
      !target.closest("[data-overlay]") &&
      !target.closest("[data-toolbar]")
    ) {
      setSelectedOverlayId(null);
      // Toggle image selection
      const currentPg = pages[currentPageIndex];
      if (currentPg?.imageUrl && !isCropMode) {
        setImageSelected((prev) => !prev);
      }
    } else {
      // Deselect image when clicking overlay or toolbar
      setImageSelected(false);
    }

    // Only pan if clicking on the image/background area, not on an overlay
    if (target.closest("[data-overlay]") || target.closest("[data-toolbar]"))
      return;

    if (isCropMode) return;

    const currentPg = pages[currentPageIndex];
    if (!currentPg) return;

    e.preventDefault();
    setIsPanningImage(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offX: currentPg.imageOffsetX,
      offY: currentPg.imageOffsetY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleContainerPointerMove(e: React.PointerEvent) {
    if (imageResizeHandle) return;
    if (!isPanningImage) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const deltaXPct = ((e.clientX - panStartRef.current.x) / rect.width) * 100;
    const deltaYPct =
      ((e.clientY - panStartRef.current.y) / rect.height) * 100;

    const newOffX = panStartRef.current.offX + deltaXPct;
    const newOffY = panStartRef.current.offY + deltaYPct;

    updateImageTransformSilent({
      imageOffsetX: newOffX,
      imageOffsetY: newOffY,
    });
  }

  function handleContainerPointerUp() {
    if (isPanningImage) {
      setIsPanningImage(false);
      triggerAutoSave();
    }
  }

  // Corner handle resize handlers
  function handleImageResizeDown(
    e: React.PointerEvent,
    corner: "tl" | "tr" | "bl" | "br",
  ) {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const currentPg = pages[currentPageIndex];
    if (!currentPg) return;

    const rect = container.getBoundingClientRect();
    const c = getContainBounds();
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
    };
    setImageResizeHandle(corner);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleImageResizeMove(e: React.PointerEvent) {
    if (!imageResizeHandle) return;
    const {
      scale: startScale,
      offX: startOffX,
      offY: startOffY,
      imgStartX,
      imgStartY,
      imgSizeX,
      imgSizeY,
    } = resizeStartRef.current;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const ptrXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const ptrYPct = ((e.clientY - rect.top) / rect.height) * 100;

    // Determine anchor corner (opposite of dragged corner)
    let anchorXPct: number, anchorYPct: number;
    const imgEndX = imgStartX + imgSizeX;
    const imgEndY = imgStartY + imgSizeY;
    if (imageResizeHandle === "br") {
      anchorXPct = startScale * imgStartX + startOffX;
      anchorYPct = startScale * imgStartY + startOffY;
    } else if (imageResizeHandle === "tl") {
      anchorXPct = startScale * imgEndX + startOffX;
      anchorYPct = startScale * imgEndY + startOffY;
    } else if (imageResizeHandle === "tr") {
      anchorXPct = startScale * imgStartX + startOffX;
      anchorYPct = startScale * imgEndY + startOffY;
    } else {
      // bl
      anchorXPct = startScale * imgEndX + startOffX;
      anchorYPct = startScale * imgStartY + startOffY;
    }

    const currDistX = Math.abs(ptrXPct - anchorXPct);
    const currDistY = Math.abs(ptrYPct - anchorYPct);
    const initDistX = startScale * imgSizeX;
    const initDistY = startScale * imgSizeY;
    const ratioX = initDistX > 0 ? currDistX / initDistX : 0;
    const ratioY = initDistY > 0 ? currDistY / initDistY : 0;
    const maxRatio = Math.max(ratioX, ratioY);
    if (maxRatio < 0.01) return;

    const newScale = Math.max(0.3, Math.min(3.0, maxRatio * startScale));

    // Compute offset so anchor corner stays fixed
    let newOffX: number, newOffY: number;
    if (imageResizeHandle === "br") {
      newOffX = startOffX + (startScale - newScale) * imgStartX;
      newOffY = startOffY + (startScale - newScale) * imgStartY;
    } else if (imageResizeHandle === "tl") {
      newOffX = startOffX + (startScale - newScale) * imgEndX;
      newOffY = startOffY + (startScale - newScale) * imgEndY;
    } else if (imageResizeHandle === "tr") {
      newOffX = startOffX + (startScale - newScale) * imgStartX;
      newOffY = startOffY + (startScale - newScale) * imgEndY;
    } else {
      // bl
      newOffX = startOffX + (startScale - newScale) * imgEndX;
      newOffY = startOffY + (startScale - newScale) * imgStartY;
    }

    updateImageTransformSilent({
      imageScale: newScale,
      imageOffsetX: newOffX,
      imageOffsetY: newOffY,
    });
  }

  function handleImageResizeUp() {
    if (imageResizeHandle) {
      setImageResizeHandle(null);
      triggerAutoSave();
    }
  }

  return {
    isPanningImage,
    imageResizeHandle,
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
  };
}
