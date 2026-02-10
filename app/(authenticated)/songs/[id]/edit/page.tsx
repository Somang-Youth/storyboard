import { notFound } from "next/navigation"
import { getSong } from "@/lib/queries/songs"
import { PageHeader } from "@/components/layout/page-header"
import { SongForm } from "@/components/songs/song-form"
import { SheetMusicUploader } from "@/components/songs/sheet-music-uploader"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"

export default async function EditSongPage({
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
      <PageHeader title="곡 편집" />
      <div className="space-y-11">
        <SongForm song={song} />

        <div>
          <h2 className="text-xl font-semibold mb-6">악보 관리</h2>
          <SheetMusicUploader songId={song.id} />
          {song.sheetMusic.length > 0 && (
            <div className="mt-8">
              <SheetMusicGallery
                files={song.sheetMusic}
                editable
                songId={song.id}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
