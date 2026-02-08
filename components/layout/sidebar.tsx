"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MusicNoteSquare01Icon,
  Playlist01Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons"

const navItems = [
  {
    label: "콘티 목록",
    href: "/contis",
    icon: Playlist01Icon,
  },
  {
    label: "곡 라이브러리",
    href: "/songs",
    icon: MusicNoteSquare01Icon,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <aside className="w-64 fixed left-0 top-0 h-screen border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <Link href="/" className="text-lg font-bold">
          Storyboard
        </Link>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-4" />
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
    </aside>
  )
}
