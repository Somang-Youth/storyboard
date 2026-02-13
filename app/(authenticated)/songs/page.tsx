import Link from "next/link"
import { getSongs } from "@/lib/queries/songs"
import { PageHeader } from "@/components/layout/page-header"
import { SongList } from "@/components/songs/song-list"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

export default async function SongsPage() {
  const songs = await getSongs()

  return (
    <div>
      <PageHeader title="찬양 라이브러리" description="예배에 사용할 곡을 관리합니다">
        <Button size="icon" className="sm:hidden" aria-label="새 곡 추가"
          render={<Link href="/songs/new" />}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
        </Button>
        <Button className="hidden sm:inline-flex"
          render={<Link href="/songs/new" />}>
          <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" strokeWidth={2} />
          새 곡 추가
        </Button>
      </PageHeader>
      <SongList songs={songs} />
    </div>
  )
}
