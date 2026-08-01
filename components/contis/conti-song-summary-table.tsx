"use client"

import { useMemo, useState, useTransition, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { YouTubeReferenceLink } from "@/components/shared/youtube-reference-link"
import { MashupConnectDialog } from "@/components/contis/mashup-connect-dialog"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ConnectIcon,
  Delete01Icon,
  PencilEdit01Icon,
  SplitIcon,
} from "@hugeicons/core-free-icons"
import { splitMashup } from "@/lib/actions/conti-songs"
import { buildArrangementItems } from "@/lib/utils/arrangement-items"
import {
  buildContiSongSummaryItems,
  type ContiSongSummaryItem,
} from "@/lib/utils/conti-song-summary-items"
import type { ArrangementItem, ContiSongSummary, ContiSongWithSong } from "@/lib/types"

type SummaryRow = ContiSongSummary | ContiSongWithSong
type RenderItem = ContiSongSummaryItem | ArrangementItem

interface ContiSongSummaryTableProps {
  songs: SummaryRow[]
  mode: "read" | "action"
  contiId?: string
  density?: "default" | "compact"
  onEdit?: (contiSongId: string) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
  onRemove?: (contiSongId: string) => void
}

function isContiSongWithSong(song: SummaryRow): song is ContiSongWithSong {
  return "song" in song
}

function isContiSongSummary(song: SummaryRow): song is ContiSongSummary {
  return !isContiSongWithSong(song)
}

function isSummaryItem(item: RenderItem): item is ContiSongSummaryItem {
  return !("song" in item.primarySong)
}

function getItemPresetName(item: RenderItem): string | null {
  if (isSummaryItem(item)) return item.presetName
  return item.primarySong.appliedPreset?.name ?? (item.presetId ? "프리셋 적용" : null)
}

function getItemYoutubeReference(item: RenderItem): string | null {
  if (isSummaryItem(item)) return item.primarySong.youtubeReference
  return item.primarySong.appliedPreset?.youtubeReference ?? null
}

function getItemYoutubeTitle(item: RenderItem): string | null {
  if (isSummaryItem(item)) return item.primarySong.youtubeTitle
  return item.primarySong.appliedPreset?.youtubeTitle ?? null
}

function getItemSectionSummary(item: RenderItem): string {
  return item.sectionOrder.length > 0 ? item.sectionOrder.join(" → ") : "-"
}

function getItemKeyTempoSummary(item: RenderItem): string {
  const parts = [
    item.keys.length > 0 ? item.keys.join("/") : null,
    item.tempos.length > 0 ? `${item.tempos.join("/")} BPM` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "-"
}

function getPrimaryContiSong(item: RenderItem): ContiSongWithSong | null {
  return isSummaryItem(item) ? null : item.primarySong
}

function isSingleContiSongItem(item: RenderItem): item is ArrangementItem & { type: "single" } {
  return item.type === "single" && !isSummaryItem(item)
}

function isMashupItem(item: RenderItem): item is RenderItem & { type: "mashup" } {
  return item.type === "mashup"
}

function isUngroupedSingleContiSongItem(item: RenderItem): item is ArrangementItem & { type: "single" } {
  return isSingleContiSongItem(item) && !item.primarySong.mashupGroupId
}

function stopRowClick(event: MouseEvent) {
  event.stopPropagation()
}

const INTERACTIVE_CHILD_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[contenteditable="true"]',
].join(", ")

function handleRowClick(event: MouseEvent<HTMLElement>, onClick?: () => void) {
  const target = event.target
  if (target instanceof Element && target.closest(INTERACTIVE_CHILD_SELECTOR)) {
    return
  }

  onClick?.()
}

export function ContiSongSummaryTable({
  songs,
  mode,
  contiId,
  density = "default",
  onEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ContiSongSummaryTableProps) {
  const router = useRouter()
  const [isSplitting, startSplitTransition] = useTransition()
  const [connectPair, setConnectPair] = useState<[ContiSongWithSong, ContiSongWithSong] | null>(null)
  const items = useMemo<RenderItem[]>(() => {
    if (songs.every(isContiSongWithSong)) return buildArrangementItems(songs)
    if (songs.every(isContiSongSummary)) return buildContiSongSummaryItems(songs)
    return songs.map((song) => (
      isContiSongWithSong(song) ? buildArrangementItems([song])[0] : buildContiSongSummaryItems([song])[0]
    ))
  }, [songs])
  const rawIndexById = useMemo(() => {
    const map = new Map<string, number>()
    songs.forEach((song, index) => map.set(song.id, index))
    return map
  }, [songs])

  function hasGroupedNeighbor(rawIndex: number, direction: -1 | 1): boolean {
    const neighbor = songs[rawIndex + direction]
    return isContiSongWithSong(neighbor) && Boolean(neighbor.mashupGroupId)
  }

  function canMoveItem(item: RenderItem, direction: -1 | 1): boolean {
    const primary = getPrimaryContiSong(item)
    if (!primary || primary.mashupGroupId) return false
    const rawIndex = rawIndexById.get(primary.id)
    if (rawIndex === undefined) return false
    if (direction === -1 && rawIndex === 0) return false
    if (direction === 1 && rawIndex === songs.length - 1) return false
    return !hasGroupedNeighbor(rawIndex, direction)
  }

  function splitItem(item: ArrangementItem & { type: "mashup" }) {
    if (!contiId || !item.primarySong.mashupGroupId) return

    const confirmed = window.confirm(
      "매시업 연결을 해제하고 두 곡의 프리셋/편집 내용을 비우시겠습니까?",
    )
    if (!confirmed) return

    startSplitTransition(async () => {
      const result = await splitMashup({
        contiId,
        mashupGroupId: item.primarySong.mashupGroupId!,
        mode: "clear",
      })

      if (result.success) {
        toast.success("매시업 연결을 해제했습니다")
      } else {
        toast.error(result.error ?? "매시업 분리 중 오류가 발생했습니다")
      }
      router.refresh()
    })
  }

  if (songs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
        등록된 곡이 없습니다.
      </div>
    )
  }

  if (density === "compact" && mode === "action") {
    return (
      <div className="space-y-2">
        {items.map((item, index) => {
          const youtubeReference = getItemYoutubeReference(item)
          const youtubeTitle = getItemYoutubeTitle(item)
          const presetName = getItemPresetName(item)
          const sectionSummary = getItemSectionSummary(item)
          const primary = item.primarySong
          const rawIndex = rawIndexById.get(primary.id) ?? index
          const editRow = () => onEdit?.(primary.id)
          const canMoveUp = canMoveItem(item, -1)
          const canMoveDown = canMoveItem(item, 1)
          const canEdit = Boolean(onEdit)
          const nextItem = items[index + 1]
          const canConnectNext =
            contiId &&
            isUngroupedSingleContiSongItem(item) &&
            nextItem &&
            isUngroupedSingleContiSongItem(nextItem)

          return (
            <div key={item.key} className="space-y-1">
              <div
                className={cn(
                  "grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-background/70 px-3 py-3 text-sm hover:bg-muted/40",
                  isMashupItem(item) && "border-primary/25 bg-primary/5 py-4",
                )}
                onClick={(event) => handleRowClick(event, canEdit ? editRow : undefined)}
              >
                <span className="font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    {isMashupItem(item) && <Badge variant="key">매시업</Badge>}
                    <p className="truncate font-medium">{item.displayTitle}</p>
                  </div>
                  {isMashupItem(item) && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.displaySongNames.join(" + ")}
                    </p>
                  )}
                  <div className="mt-1 flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="min-w-0 max-w-full truncate">
                      {getItemKeyTempoSummary(item)}
                    </span>
                    {presetName && (
                      <span className="min-w-0 max-w-full truncate">{presetName}</span>
                    )}
                    {youtubeReference && (
                      <span
                        className="min-w-0 max-w-full truncate"
                        onClick={stopRowClick}
                      >
                        <YouTubeReferenceLink
                          reference={youtubeReference}
                          title={youtubeTitle}
                          className="block max-w-full truncate underline-offset-2 hover:underline"
                        />
                      </span>
                    )}
                  </div>
                  {isMashupItem(item) && (
                    <button
                      type="button"
                      className="mt-2 flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-background/70 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      disabled={isSplitting}
                      onClick={(event) => {
                        stopRowClick(event)
                        if (!isSummaryItem(item)) splitItem(item)
                      }}
                    >
                      <HugeiconsIcon icon={SplitIcon} strokeWidth={2} className="size-3.5" />
                      <span className="truncate">매시업 연결 해제</span>
                    </button>
                  )}
                  {sectionSummary !== "-" && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {sectionSummary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1" onClick={stopRowClick}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="편집"
                    disabled={!canEdit}
                    onClick={(event) => {
                      stopRowClick(event)
                      if (!canEdit) return
                      onEdit?.(primary.id)
                    }}
                  >
                    <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="위로 이동"
                    disabled={!canMoveUp || !onMoveUp}
                    onClick={(event) => {
                      stopRowClick(event)
                      onMoveUp?.(rawIndex)
                    }}
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="아래로 이동"
                    disabled={!canMoveDown || !onMoveDown}
                    onClick={(event) => {
                      stopRowClick(event)
                      onMoveDown?.(rawIndex)
                    }}
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={isMashupItem(item) ? "매시업은 연결 해제 후 삭제" : "삭제"}
                    disabled={!onRemove || isMashupItem(item)}
                    onClick={(event) => {
                      stopRowClick(event)
                      if (isMashupItem(item)) return
                      onRemove?.(primary.id)
                    }}
                  >
                    <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              {canConnectNext && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-6 text-xs"
                    onClick={() => setConnectPair([item.primarySong, nextItem.primarySong])}
                  >
                    <HugeiconsIcon icon={ConnectIcon} strokeWidth={2} data-icon="inline-start" />
                    매시업 연결
                  </Button>
                </div>
              )}
            </div>
          )
        })}
        {contiId && connectPair && (
          <MashupConnectDialog
            contiId={contiId}
            firstSong={connectPair[0]}
            secondSong={connectPair[1]}
            open={connectPair !== null}
            onOpenChange={(open) => {
              if (!open) setConnectPair(null)
            }}
          />
        )}
      </div>
    )
  }

  const showActions = mode === "action"
  const gridTemplateClass = showActions
    ? "grid-cols-[3rem_1.2fr_5rem_5rem_minmax(12rem,1fr)_6rem_minmax(10rem,0.8fr)_9rem]"
    : "grid-cols-[3rem_1.2fr_5rem_5rem_minmax(12rem,1fr)_6rem_minmax(10rem,0.8fr)]"
  const tableMinWidthClass = showActions ? "min-w-[64rem]" : "min-w-[56rem]"

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className={tableMinWidthClass}>
        <div
          className={`grid ${gridTemplateClass} gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground`}
        >
          <span>#</span>
          <span>곡</span>
          <span>Key</span>
          <span>BPM</span>
          <span>섹션</span>
          <span>프리셋</span>
          <span>YouTube</span>
          {showActions && <span className="text-right">작업</span>}
        </div>
        {items.map((item, index) => {
          const keys = item.keys
          const tempos = item.tempos
          const presetName = getItemPresetName(item)
          const primary = item.primarySong
          const rawIndex = rawIndexById.get(primary.id) ?? index
          const editRow = () => onEdit?.(primary.id)
          const canMoveUp = canMoveItem(item, -1)
          const canMoveDown = canMoveItem(item, 1)
          const canEdit = Boolean(onEdit)
          const nextItem = items[index + 1]
          const canConnectNext =
            contiId &&
            showActions &&
            isUngroupedSingleContiSongItem(item) &&
            nextItem &&
            isUngroupedSingleContiSongItem(nextItem)

          return (
            <div key={item.key}>
              <div
                className={cn(
                  `grid ${gridTemplateClass} items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0`,
                  showActions && "cursor-pointer hover:bg-muted/40",
                  isMashupItem(item) && "border-primary/20 bg-primary/5 py-4",
                )}
                onClick={showActions ? (event) => handleRowClick(event, canEdit ? editRow : undefined) : undefined}
              >
                <span className="font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    {isMashupItem(item) && <Badge variant="key">매시업</Badge>}
                    <span className="truncate font-medium">{item.displayTitle}</span>
                  </span>
                  {isMashupItem(item) && (
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {item.displaySongNames.join(" + ")}
                    </span>
                  )}
                  {showActions && isMashupItem(item) && (
                    <button
                      type="button"
                      className="mt-2 flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-background/70 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      disabled={isSplitting}
                      onClick={(event) => {
                        stopRowClick(event)
                        if (!isSummaryItem(item)) splitItem(item)
                      }}
                    >
                      <HugeiconsIcon icon={SplitIcon} strokeWidth={2} className="size-3.5" />
                      <span className="truncate">연결 해제</span>
                    </button>
                  )}
                </span>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {keys.length > 0
                    ? keys.map((key, keyIndex) => (
                        <Badge key={`${key}-${keyIndex}`} variant="key">
                          {key}
                        </Badge>
                      ))
                    : "-"}
                </span>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {tempos.length > 0
                    ? tempos.map((tempo, tempoIndex) => (
                        <Badge key={`${tempo}-${tempoIndex}`} variant="tempo">
                          {tempo}
                        </Badge>
                      ))
                    : "-"}
                </span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {getItemSectionSummary(item)}
                </span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {presetName ?? "-"}
                </span>
                <span
                  className="min-w-0 truncate text-muted-foreground"
                  onClick={showActions ? stopRowClick : undefined}
                >
                  <YouTubeReferenceLink
                    reference={getItemYoutubeReference(item)}
                    title={getItemYoutubeTitle(item)}
                    className="text-primary block truncate underline-offset-4 hover:underline"
                    fallback="-"
                  />
                </span>
                {showActions && (
                  <div className="flex justify-end gap-1" onClick={stopRowClick}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="편집"
                      disabled={!canEdit}
                      onClick={(event) => {
                        stopRowClick(event)
                        if (!canEdit) return
                        onEdit?.(primary.id)
                      }}
                    >
                      <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="위로 이동"
                      disabled={!canMoveUp || !onMoveUp}
                      onClick={(event) => {
                        stopRowClick(event)
                        onMoveUp?.(rawIndex)
                      }}
                    >
                      <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="아래로 이동"
                      disabled={!canMoveDown || !onMoveDown}
                      onClick={(event) => {
                        stopRowClick(event)
                        onMoveDown?.(rawIndex)
                      }}
                    >
                      <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={isMashupItem(item) ? "매시업은 연결 해제 후 삭제" : "삭제"}
                      disabled={!onRemove || isMashupItem(item)}
                      onClick={(event) => {
                        stopRowClick(event)
                        if (isMashupItem(item)) return
                        onRemove?.(primary.id)
                      }}
                    >
                      <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                    </Button>
                  </div>
                )}
              </div>
              {canConnectNext && (
                <div className="flex justify-center border-b bg-muted/20 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-6 text-xs"
                    onClick={() => setConnectPair([item.primarySong, nextItem.primarySong])}
                  >
                    <HugeiconsIcon icon={ConnectIcon} strokeWidth={2} data-icon="inline-start" />
                    매시업 연결
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {contiId && connectPair && (
        <MashupConnectDialog
          contiId={contiId}
          firstSong={connectPair[0]}
          secondSong={connectPair[1]}
          open={connectPair !== null}
          onOpenChange={(open) => {
            if (!open) setConnectPair(null)
          }}
        />
      )}
    </div>
  )
}
