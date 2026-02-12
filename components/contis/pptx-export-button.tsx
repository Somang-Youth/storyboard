"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Presentation01Icon,
  ArrowLeft02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons"
import { listPptxFiles, exportContiToPptx } from "@/lib/actions/pptx-export"
import { buildPptxSongData } from "@/lib/utils/pptx-helpers"
import type { ContiWithSongs, PptxDriveFile } from "@/lib/types"

type Step = "file-list" | "mode-select" | "confirm"

interface PptxExportButtonProps {
  conti: ContiWithSongs
  iconOnly?: boolean
}

const SECTION_PREFIX = process.env.NEXT_PUBLIC_PPTX_SECTION_PREFIX || "찬양"

export function PptxExportButton({ conti, iconOnly = false }: PptxExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("file-list")
  const [isPending, startTransition] = useTransition()

  // Step 1: File list
  const [files, setFiles] = useState<PptxDriveFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)

  // Step 2: Selected file + mode
  const [selectedFile, setSelectedFile] = useState<PptxDriveFile | null>(null)
  const [overwrite, setOverwrite] = useState(true)
  const [outputFileName, setOutputFileName] = useState("")

  // Songs eligible for export (have sectionOrder configured)
  const eligibleSongs = useMemo(() => {
    return conti.songs
      .filter((cs) => cs.overrides.sectionOrder.length > 0)
      .slice(0, 4)
  }, [conti.songs])

  const hasEligibleSongs = eligibleSongs.length > 0

  // Auto-generated section names for summary
  const sectionSummary = useMemo(() => {
    return eligibleSongs.map((cs, idx) => ({
      sectionName: `${SECTION_PREFIX} ${idx + 1}`,
      songName: cs.song.name,
      slideCount: cs.overrides.sectionOrder.filter(
        (s) => s.trim().toLowerCase() !== "intro"
      ).length,
    }))
  }, [eligibleSongs])

  // Fetch files when dialog opens
  useEffect(() => {
    if (open && step === "file-list") {
      setFilesLoading(true)
      setFilesError(null)
      listPptxFiles().then((result) => {
        if (result.success && result.data) {
          setFiles(result.data.files)
        } else {
          setFilesError(result.error || "파일 목록을 가져오지 못했습니다")
        }
        setFilesLoading(false)
      })
    }
  }, [open, step])

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (!newOpen) {
      setStep("file-list")
      setSelectedFile(null)
      setOverwrite(true)
      setOutputFileName("")
    }
  }

  function handleSelectFile(file: PptxDriveFile) {
    setSelectedFile(file)
    setOutputFileName(file.name)
    setStep("mode-select")
  }

  function handleModeConfirm() {
    if (!overwrite && !outputFileName.trim()) {
      toast.error("파일명을 입력해주세요")
      return
    }
    setStep("confirm")
  }

  function handleBack() {
    if (step === "mode-select") {
      setStep("file-list")
      setSelectedFile(null)
    } else if (step === "confirm") {
      setStep("mode-select")
    }
  }

  function handleExport() {
    if (!selectedFile) return

    startTransition(async () => {
      const songData = buildPptxSongData(conti.songs, SECTION_PREFIX)

      const result = await exportContiToPptx({
        fileId: selectedFile.file_id,
        overwrite,
        outputFileName: overwrite ? undefined : outputFileName.trim(),
        songs: songData,
      })

      if (!result.success || !result.data) {
        toast.error(result.error || "PPT 내보내기에 실패했습니다")
        return
      }

      handleOpenChange(false)

      if (result.data.web_view_link) {
        toast.success("PPT 내보내기 완료", {
          description: `${result.data.file_name} (${result.data.slides_generated}슬라이드)`,
          action: {
            label: "Google Drive에서 열기",
            onClick: () => window.open(result.data!.web_view_link, "_blank"),
          },
        })
      } else {
        toast.success("PPT 내보내기 완료", {
          description: `${result.data.file_name} 파일이 Google Drive에 저장되었습니다`,
        })
      }
    })
  }

  if (iconOnly) {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          aria-label="PPT 내보내기"
          onClick={() => setOpen(true)}
          disabled={!hasEligibleSongs}
        >
          <HugeiconsIcon icon={Presentation01Icon} strokeWidth={2} />
        </Button>
        <PptxExportDialog />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!hasEligibleSongs}
      >
        <HugeiconsIcon icon={Presentation01Icon} strokeWidth={2} data-icon="inline-start" />
        PPT 내보내기
      </Button>
      <PptxExportDialog />
    </>
  )

  function PptxExportDialog() {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {step === "file-list" && "PPT 파일 선택"}
              {step === "mode-select" && "내보내기 방식"}
              {step === "confirm" && "내보내기 확인"}
            </DialogTitle>
            <DialogDescription>
              {step === "file-list" && "Google Drive에서 수정할 .pptx 파일을 선택하세요."}
              {step === "mode-select" && "선택한 파일을 덮어쓰거나 새 파일로 저장할 수 있습니다."}
              {step === "confirm" && "아래 내용을 확인한 후 내보내기를 시작하세요."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: File List */}
          {step === "file-list" && (
            <div className="flex flex-col gap-2">
              {filesLoading && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  파일 목록을 불러오는 중...
                </p>
              )}
              {filesError && (
                <p className="text-sm text-destructive py-4 text-center">
                  {filesError}
                </p>
              )}
              {!filesLoading && !filesError && files.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  .pptx 파일이 없습니다
                </p>
              )}
              {!filesLoading && files.map((file) => (
                <button
                  key={file.file_id}
                  type="button"
                  onClick={() => handleSelectFile(file)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                >
                  <HugeiconsIcon icon={Presentation01Icon} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    {file.modified_time && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.modified_time).toLocaleDateString("ko-KR")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Mode Selection */}
          {step === "mode-select" && selectedFile && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">선택한 파일</p>
                <p className="text-sm font-medium">{selectedFile.name}</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setOverwrite(true)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    overwrite ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">덮어쓰기</p>
                    <p className="text-xs text-muted-foreground">
                      선택한 파일을 직접 수정합니다
                    </p>
                  </div>
                  {overwrite && (
                    <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="shrink-0 text-primary" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setOverwrite(false)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    !overwrite ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">새 파일</p>
                    <p className="text-xs text-muted-foreground">
                      새로운 파일로 저장합니다
                    </p>
                  </div>
                  {!overwrite && (
                    <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="shrink-0 text-primary" />
                  )}
                </button>
              </div>

              {!overwrite && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="output-name" className="text-sm font-medium">
                    파일명
                  </label>
                  <Input
                    id="output-name"
                    value={outputFileName}
                    onChange={(e) => setOutputFileName(e.target.value)}
                    placeholder="output.pptx"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && selectedFile && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">파일</span>
                  <span className="font-medium">{selectedFile.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">방식</span>
                  <span className="font-medium">
                    {overwrite ? "덮어쓰기" : `새 파일: ${outputFileName}`}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">곡 목록</p>
                <div className="space-y-1">
                  {sectionSummary.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>
                        <span className="text-muted-foreground">{item.sectionName}:</span>{" "}
                        {item.songName}
                      </span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        ~{item.slideCount}슬라이드
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {step !== "file-list" && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isPending}
              >
                <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} data-icon="inline-start" />
                뒤로
              </Button>
            )}
            {step === "file-list" && (
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                취소
              </Button>
            )}
            {step === "mode-select" && (
              <Button onClick={handleModeConfirm}>
                다음
              </Button>
            )}
            {step === "confirm" && (
              <Button
                onClick={handleExport}
                disabled={isPending}
              >
                {isPending ? "내보내는 중..." : "내보내기"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}
