"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { usePathname } from "next/navigation"

interface MobileNavContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // pathname 변경 시 자동 닫힘
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpen(false)
  }, [pathname])

  return (
    <MobileNavContext value={{ isOpen, setIsOpen }}>
      {children}
    </MobileNavContext>
  )
}

export function useMobileNav() {
  const context = useContext(MobileNavContext)
  if (!context) {
    throw new Error("useMobileNav must be used within MobileNavProvider")
  }
  return context
}
