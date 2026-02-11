"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useDrawerPortal } from "./drawer-context";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onBeforeClose?: () => boolean;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  onBeforeClose,
  title,
  footer,
  children,
}: DrawerProps) {
  const { portalRef, setIsOpen } = useDrawerPortal();
  const [mounted, setMounted] = useState(false);

  // Sync open state with layout context
  useEffect(() => {
    setIsOpen(open);
  }, [open, setIsOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => setIsOpen(false);
  }, [setIsOpen]);

  // Keep content mounted during close animation
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (onBeforeClose && !onBeforeClose()) {
      return;
    }
    onClose();
  }, [onBeforeClose, onClose]);

  // ESC key handler
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  if (!mounted || !portalRef.current) return null;

  const drawerContent = (
    <div className="flex h-full min-w-0 md:min-w-[40%] flex-col">
      {/* Mobile drag handle */}
      <div className="flex justify-center pt-3 pb-2 md:hidden">
        <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="size-9 rounded-full"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            strokeWidth={2}
            className="size-5"
          />
          <span className="sr-only">닫기</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

      {/* Footer */}
      {footer && <div className="border-t px-6 py-4">{footer}</div>}
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Portal content into AppShell aside */}
      {createPortal(drawerContent, portalRef.current)}
    </>
  );
}
