import Link from "next/link"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import type { Conti } from "@/lib/types"

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}년 ${month}월 ${day}일`
}

export function ContiCard({ conti }: { conti: Conti }) {
  return (
    <Link href={`/contis/${conti.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardDescription>{formatDate(conti.date)}</CardDescription>
          <CardTitle>{conti.title}</CardTitle>
          {conti.description && (
            <CardDescription className="line-clamp-2">
              {conti.description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  )
}
