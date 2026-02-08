import { PageHeader } from "@/components/layout/page-header"
import { SongForm } from "@/components/songs/song-form"

export default function NewSongPage() {
  return (
    <div>
      <PageHeader title="새 곡 추가" />
      <SongForm />
    </div>
  )
}
