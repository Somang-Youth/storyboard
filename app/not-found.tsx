import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-4">페이지를 찾을 수 없습니다</p>
        <Button render={<Link href="/" />}>홈으로 돌아가기</Button>
      </div>
    </div>
  )
}
