import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, backHref, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-8 mt-1" />
          </Link>
        )}
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1.5">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}
