"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MusicNoteSquare01Icon,
  Playlist01Icon,
  Calendar03Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons"
import { useSidebarHeader } from "@/components/layout/sidebar-header-context"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useMobileNav } from "@/components/layout/mobile-nav-context"

const navItems = [
  {
    label: "콘티 목록",
    href: "/contis",
    icon: Playlist01Icon,
  },
  {
    label: "찬양 라이브러리",
    href: "/songs",
    icon: MusicNoteSquare01Icon,
  },
  {
    label: "예배 준비",
    href: "/worship-prep",
    icon: Calendar03Icon,
  },
]

function SidebarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const { headerContent } = useSidebarHeader()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <>
      <div className="p-4 border-b">
        {headerContent ?? (
          <Link href="/" className="text-xl font-bold">
            Storyboard
          </Link>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
        >
          <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
          로그아웃
        </Button>
      </div>
    </>
  )
}

export function Sidebar() {
  const { isOpen, setIsOpen } = useMobileNav()

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden md:flex w-45 fixed left-0 top-0 h-screen border-r bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile: Sheet sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
