import { useState, useRef } from "react";
import { nanoid } from "nanoid";
import { buildDefaultOverlays } from "@/lib/utils/pdf-export-helpers";
import type { OverlayElement } from "@/lib/types";
import type { EditorPage } from "../types";

export function useOverlays(
  pages: EditorPage[],
  setPages: React.Dispatch<React.SetStateAction<EditorPage[]>>,
  currentPageIndex: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
  triggerAutoSave: () => void,
) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  function updateOverlay(overlayId: string, updates: Partial<OverlayElement>) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return {
          ...page,
          overlays: page.overlays.map((o) =>
            o.id === overlayId ? { ...o, ...updates } : o,
          ),
        };
      }),
    );
    triggerAutoSave();
  }

  function addCustomOverlay() {
    const newOverlay: OverlayElement = {
      id: nanoid(),
      type: "custom",
      text: "텍스트",
      x: 50,
      y: 50,
      fontSize: 16,
      color: "#000000",
    };
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return { ...page, overlays: [...page.overlays, newOverlay] };
      }),
    );
    triggerAutoSave();
  }

  function deleteOverlay(overlayId: string) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return {
          ...page,
          overlays: page.overlays.filter((o) => o.id !== overlayId),
        };
      }),
    );
    setSelectedOverlayId(null);
    triggerAutoSave();
  }

  // NEW FEATURE: Reset non-custom overlays to defaults
  function resetOverlaysToDefault(
    songIndex: number,
    sectionOrder: string[],
    tempos: number[],
  ) {
    const defaults = buildDefaultOverlays(songIndex, sectionOrder, tempos);
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        const customOverlays = page.overlays.filter(
          (o) => o.type === "custom",
        );
        return { ...page, overlays: [...defaults, ...customOverlays] };
      }),
    );
    triggerAutoSave();
  }

  // Overlay drag handlers
  function handlePointerDown(e: React.PointerEvent, overlayId: string) {
    e.stopPropagation();

    // Allow contentEditable text editing
    if ((e.target as HTMLElement).isContentEditable) return;

    e.preventDefault();
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const overlay = pages[currentPageIndex]?.overlays.find(
      (o) => o.id === overlayId,
    );
    if (!overlay) return;

    const overlayPxX = (overlay.x / 100) * rect.width;
    const overlayPxY = (overlay.y / 100) * rect.height;
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    dragOffsetRef.current = {
      x: pointerX - overlayPxX,
      y: pointerY - overlayPxY,
    };
    setDraggingId(overlayId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent, overlayId: string) {
    if (draggingId !== overlayId) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const x =
      ((e.clientX - rect.left - dragOffsetRef.current.x) / rect.width) * 100;
    const y =
      ((e.clientY - rect.top - dragOffsetRef.current.y) / rect.height) * 100;

    updateOverlay(overlayId, {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }

  function handlePointerUp(e: React.PointerEvent, overlayId: string) {
    if (draggingId === overlayId) {
      setDraggingId(null);
      // If movement < 5px, treat as click (select overlay)
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        setSelectedOverlayId(overlayId);
      }
    }
  }

  return {
    draggingId,
    selectedOverlayId,
    setSelectedOverlayId,
    updateOverlay,
    addCustomOverlay,
    deleteOverlay,
    resetOverlaysToDefault,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
