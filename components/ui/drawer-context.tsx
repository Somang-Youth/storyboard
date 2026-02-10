"use client"

import { createContext, useContext, useRef, useState } from "react"

interface DrawerContextValue {
  portalRef: React.RefObject<HTMLDivElement | null>
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function useDrawerPortal() {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error("useDrawerPortal must be used within DrawerProvider")
  return ctx
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const portalRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <DrawerContext.Provider value={{ portalRef, isOpen, setIsOpen }}>
      {children}
    </DrawerContext.Provider>
  )
}
