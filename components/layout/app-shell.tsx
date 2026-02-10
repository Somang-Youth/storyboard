"use client";

import { Sidebar } from "@/components/layout/sidebar";
import {
  DrawerProvider,
  useDrawerPortal,
} from "@/components/ui/drawer-context";
import { SidebarHeaderProvider } from "@/components/layout/sidebar-header-context";
import { MobileNavProvider, useMobileNav } from "@/components/layout/mobile-nav-context";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { portalRef, isOpen } = useDrawerPortal();
  const { setIsOpen: setNavOpen } = useMobileNav();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col md:ml-64 min-w-0">
        <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
          <Button variant="ghost" size="icon" onClick={() => setNavOpen(true)}>
            <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
          </Button>
          <span className="font-semibold">Storyboard</span>
        </header>
        <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
      </div>
      <aside
        ref={portalRef}
        className={cn(
          "shrink-0 flex flex-col bg-background overflow-hidden",
          // Mobile: fixed bottom sheet with definite height for inner scroll
          "fixed inset-x-0 bottom-0 z-50 h-[90vh] rounded-t-2xl shadow-xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
          // Desktop: in-flow sticky sidebar
          "md:sticky md:inset-auto md:top-0 md:z-auto md:h-screen md:max-h-none md:rounded-none md:border-l md:shadow-none",
          "md:transition-[width] md:duration-300 md:ease-in-out",
          "md:translate-y-0 md:pointer-events-auto",
          isOpen ? "md:w-[20%]" : "md:w-0 md:border-l-0",
        )}
      />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DrawerProvider>
      <SidebarHeaderProvider>
        <MobileNavProvider>
          <AppShellInner>{children}</AppShellInner>
        </MobileNavProvider>
      </SidebarHeaderProvider>
    </DrawerProvider>
  );
}
