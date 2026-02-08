import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ContiNotFound() {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold mb-2">콘티를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground mb-4">요청하신 콘티가 존재하지 않거나 삭제되었습니다</p>
      <Button variant="outline" render={<Link href="/contis" />}>콘티 목록으로</Button>
    </div>
  )
}
