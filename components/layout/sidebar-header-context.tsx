"use client"

import { createContext, useContext, useState } from "react"

interface SidebarHeaderContextValue {
  headerContent: React.ReactNode | null
  setHeaderContent: (content: React.ReactNode | null) => void
}

const SidebarHeaderContext = createContext<SidebarHeaderContextValue | null>(null)

export function useSidebarHeader() {
  const ctx = useContext(SidebarHeaderContext)
  if (!ctx) throw new Error("useSidebarHeader must be used within SidebarHeaderProvider")
  return ctx
}

export function SidebarHeaderProvider({ children }: { children: React.ReactNode }) {
  const [headerContent, setHeaderContent] = useState<React.ReactNode | null>(null)

  return (
    <SidebarHeaderContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </SidebarHeaderContext.Provider>
  )
}
