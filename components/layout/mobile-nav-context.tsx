"use client"

import { createContext, useContext, useState, useRef } from "react"
import { usePathname } from "next/navigation"

interface MobileNavContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const prevPathname = useRef(pathname)

  // pathname 변경 시 자동 닫힘
  if (prevPathname.current !== pathname) {
    prevPathname.current = pathname
    if (isOpen) {
      setIsOpen(false)
    }
  }

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
