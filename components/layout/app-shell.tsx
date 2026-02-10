"use client";

import { Sidebar } from "@/components/layout/sidebar";
import {
  DrawerProvider,
  useDrawerPortal,
} from "@/components/ui/drawer-context";
import { SidebarHeaderProvider } from "@/components/layout/sidebar-header-context";
import { cn } from "@/lib/utils";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { portalRef, isOpen } = useDrawerPortal();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1 p-6 min-w-0">{children}</main>
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
        <AppShellInner>{children}</AppShellInner>
      </SidebarHeaderProvider>
    </DrawerProvider>
  );
}
