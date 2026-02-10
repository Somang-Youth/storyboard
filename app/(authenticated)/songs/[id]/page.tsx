import Link from "next/link"
import { notFound } from "next/navigation"
import { getSong } from "@/lib/queries/songs"
import { PageHeader } from "@/components/layout/page-header"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { SongDeleteButton } from "@/components/songs/song-delete-button"
import { PresetList } from "@/components/songs/preset-list"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const song = await getSong(id)

  if (!song) {
    notFound()
  }

  return (
    <div>
      <PageHeader title={song.name}>
        <Button variant="outline" render={<Link href={`/songs/${song.id}/edit`} />}>
          <HugeiconsIcon icon={PencilEdit01Icon} data-icon="inline-start" strokeWidth={2} />
          편집
        </Button>
        <SongDeleteButton songId={song.id} songName={song.name} />
      </PageHeader>

      <div className="space-y-6">
        {song.sheetMusic.length > 0 ? (
          <div>
            <h2 className="text-xl font-semibold mb-4">악보</h2>
            <SheetMusicGallery files={song.sheetMusic} />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>등록된 악보가 없습니다</p>
            <Button
              variant="outline"
              className="mt-4"
              render={<Link href={`/songs/${song.id}/edit`} />}
            >
              악보 추가하기
            </Button>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">프리셋</h2>
          <PresetList songId={song.id} presets={song.presets ?? []} />
        </div>
      </div>
    </div>
  )
}
