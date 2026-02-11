import { useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { generatePdfFilename } from "@/lib/utils/pdf-export-helpers";
import { renderPdfPageToDataUrl } from "@/lib/utils/pdfjs";
import {
  exportContiPdf,
} from "@/lib/actions/conti-pdf-exports";
import {
  saveSongPageImageFromForm,
  deletePageImagesForConti,
} from "@/lib/actions/song-page-images";
import { applySavedCrop } from "../utils";
import type {
  ContiWithSongsAndSheetMusic,
  ContiPdfExport,
} from "@/lib/types";
import type { EditorPage } from "../types";

export function usePdfExport(
  pages: EditorPage[],
  conti: ContiWithSongsAndSheetMusic,
  existingExport: ContiPdfExport | null,
  containerRef: React.RefObject<HTMLDivElement | null>,
  performSave: () => Promise<void>,
) {
  const [exporting, setExporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(
    existingExport?.pdfUrl ?? null,
  );

  async function handleExport() {
    setExporting(true);
    try {
      // Save current layout first
      await performSave();

      // Use container dimensions so overlay font sizes match preview exactly
      const canvasWidth = containerRef.current?.clientWidth ?? 768;
      const canvasHeight =
        containerRef.current?.clientHeight ?? Math.round(768 * 1.414);

      // Generate meaningful filename
      const songNames = conti.songs.map((cs) => cs.song.name);
      const pdfFilename = generatePdfFilename(
        conti.title,
        conti.date,
        songNames,
      );

      // Ensure Pretendard font is loaded before export
      try {
        await document.fonts.load('16px "Pretendard Variable"');
      } catch {
        await document.fonts.load("16px Pretendard").catch(() => {});
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = 595.28;
      const pageHeight = 841.89;

      const pageUploads: {
        dataUrl: string;
        songId: string;
        pageIndex: number;
        sheetMusicFileId: string | null;
        pdfPageIndex: number | null;
        presetSnapshot: string;
      }[] = [];

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();

        // Create a temporary render container
        const renderDiv = document.createElement("div");
        renderDiv.style.width = `${canvasWidth}px`;
        renderDiv.style.height = `${canvasHeight}px`;
        renderDiv.style.position = "fixed";
        renderDiv.style.left = "-9999px";
        renderDiv.style.top = "-9999px";
        renderDiv.style.background = "white";
        renderDiv.style.overflow = "hidden";
        document.body.appendChild(renderDiv);

        let page = pages[i];

        // If this is a PDF page that hasn't been rendered yet, render it now
        if (
          page.imageUrl === null &&
          page.pdfPageIndex !== null &&
          page.sheetMusicFileId
        ) {
          let fileUrl: string | null = null;
          for (const cs of conti.songs) {
            for (const sm of cs.sheetMusic) {
              if (sm.id === page.sheetMusicFileId) {
                fileUrl = sm.fileUrl;
                break;
              }
            }
            if (fileUrl) break;
          }
          if (fileUrl) {
            try {
              const renderedUrl = await renderPdfPageToDataUrl(
                fileUrl,
                page.pdfPageIndex + 1,
              );
              if (
                page.cropX !== null &&
                page.cropY !== null &&
                page.cropWidth !== null &&
                page.cropHeight !== null
              ) {
                page = {
                  ...page,
                  imageUrl: await applySavedCrop(
                    renderedUrl,
                    page.cropX,
                    page.cropY,
                    page.cropWidth,
                    page.cropHeight,
                  ),
                };
              } else {
                page = { ...page, imageUrl: renderedUrl };
              }
            } catch (err) {
              console.error(
                `[PDF Export] Failed to render PDF page ${page.pdfPageIndex} for file ${page.sheetMusicFileId}:`,
                err,
              );
            }
          }
        }

        // Render sheet music image
        if (page.imageUrl) {
          const scale = page.imageScale ?? 1;
          const offX = page.imageOffsetX ?? 0;
          const offY = page.imageOffsetY ?? 0;

          // Load the source image
          const srcImg = new Image();
          srcImg.crossOrigin = "anonymous";
          srcImg.src = page.imageUrl;
          await new Promise<void>((resolve, reject) => {
            if (srcImg.complete && srcImg.naturalWidth > 0) {
              resolve();
              return;
            }
            srcImg.onload = () => resolve();
            srcImg.onerror = () => reject(new Error("Image load failed"));
          });

          // Calculate "contain" dimensions within canvasWidth x canvasHeight
          const imgAspect = srcImg.naturalWidth / srcImg.naturalHeight;
          const pageAspect = canvasWidth / canvasHeight;
          let drawWidth: number,
            drawHeight: number,
            drawX: number,
            drawY: number;
          if (imgAspect > pageAspect) {
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imgAspect;
            drawX = 0;
            drawY = (canvasHeight - drawHeight) / 2;
          } else {
            drawHeight = canvasHeight;
            drawWidth = canvasHeight * imgAspect;
            drawX = (canvasWidth - drawWidth) / 2;
            drawY = 0;
          }

          // Apply scale and offset
          const scaledWidth = drawWidth * scale;
          const scaledHeight = drawHeight * scale;
          const finalX = drawX * scale + (offX / 100) * canvasWidth;
          const finalY = drawY * scale + (offY / 100) * canvasHeight;

          // Pre-render to a canvas at 2x for quality
          const preCanvas = document.createElement("canvas");
          preCanvas.width = canvasWidth * 2;
          preCanvas.height = canvasHeight * 2;
          const preCtx = preCanvas.getContext("2d")!;
          preCtx.scale(2, 2);
          preCtx.drawImage(srcImg, finalX, finalY, scaledWidth, scaledHeight);

          // Insert as a flat image into the render div
          const flatImg = document.createElement("img");
          flatImg.src = preCanvas.toDataURL("image/png");
          flatImg.style.position = "absolute";
          flatImg.style.top = "0";
          flatImg.style.left = "0";
          flatImg.style.width = `${canvasWidth}px`;
          flatImg.style.height = `${canvasHeight}px`;
          renderDiv.appendChild(flatImg);

          // Wait for the flat image to load
          await new Promise<void>((resolve) => {
            if (flatImg.complete) {
              resolve();
              return;
            }
            flatImg.onload = () => resolve();
            flatImg.onerror = () => resolve();
          });
        } else {
          // Metadata-only page or unrendered PDF page
          const songName = conti.songs[page.songIndex]?.song.name ?? "";
          const placeholder = document.createElement("div");
          placeholder.style.position = "absolute";
          placeholder.style.inset = "0";
          placeholder.style.display = "flex";
          placeholder.style.alignItems = "center";
          placeholder.style.justifyContent = "center";
          placeholder.style.color = "#888";
          placeholder.style.fontSize = "18px";
          placeholder.textContent = songName;
          placeholder.style.fontFamily =
            '"Pretendard Variable", Pretendard, -apple-system, sans-serif';
          renderDiv.appendChild(placeholder);
        }

        // Render overlays
        for (const overlay of page.overlays) {
          const el = document.createElement("div");
          el.style.position = "absolute";
          el.style.left = `${overlay.x}%`;
          el.style.top = `${overlay.y}%`;
          el.style.fontSize = `${overlay.fontSize}px`;
          el.style.fontWeight =
            overlay.type === "songNumber"
              ? "700"
              : overlay.type === "custom"
                ? "400"
                : "600";
          el.style.whiteSpace = "pre-wrap";
          el.style.transform =
            overlay.type === "bpm"
              ? "translateX(-100%)"
              : overlay.type === "sectionOrder"
                ? "translateX(-50%)"
                : "none";
          el.textContent = overlay.text;
          el.style.color = overlay.color ?? "#000000";
          el.style.fontFamily =
            '"Pretendard Variable", Pretendard, -apple-system, sans-serif';
          renderDiv.appendChild(el);
        }

        // Capture to canvas
        const canvas = await html2canvas(renderDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          width: canvasWidth,
          height: canvasHeight,
          onclone: (clonedDoc) => {
            clonedDoc
              .querySelectorAll('style, link[rel="stylesheet"]')
              .forEach((el) => el.remove());
          },
        });

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

        // Collect page data for per-song image storage
        const contiSong = conti.songs[page.songIndex];
        if (contiSong) {
          pageUploads.push({
            dataUrl,
            songId: contiSong.songId,
            pageIndex: i,
            sheetMusicFileId: page.sheetMusicFileId,
            pdfPageIndex: page.pdfPageIndex ?? null,
            presetSnapshot: JSON.stringify({
              keys: contiSong.overrides.keys,
              tempos: contiSong.overrides.tempos,
              sectionOrder: contiSong.overrides.sectionOrder,
              lyrics: contiSong.overrides.lyrics,
              sectionLyricsMap: contiSong.overrides.sectionLyricsMap,
              notes: contiSong.overrides.notes ?? null,
            }),
          });
        }

        doc.addImage(dataUrl, "JPEG", 0, 0, pageWidth, pageHeight);

        // Clean up
        document.body.removeChild(renderDiv);
      }

      // Generate blob and upload
      const pdfBlob = doc.output("blob");
      const formData = new FormData();
      formData.append("file", pdfBlob, pdfFilename);

      const result = await exportContiPdf(conti.id, formData);
      if (result.success && result.data) {
        toast.success("PDF가 생성되어 다운로드됩니다");
        setPdfUrl(result.data.pdfUrl);

        // Auto-download using local blob URL for guaranteed filename
        const blobUrl = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = blobUrl;
        downloadLink.download = pdfFilename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobUrl);

        // Fire-and-forget: save individual page images linked to songs
        deletePageImagesForConti(conti.id)
          .then(() => {
            const uploadPromises = pageUploads.map(async (pu) => {
              const fd = new FormData();
              const blob = await (await fetch(pu.dataUrl)).blob();
              fd.set("file", blob, `page-${pu.pageIndex}.jpg`);
              fd.set("songId", pu.songId);
              fd.set("contiId", conti.id);
              fd.set("pageIndex", String(pu.pageIndex));
              fd.set("sheetMusicFileId", pu.sheetMusicFileId ?? "");
              fd.set(
                "pdfPageIndex",
                pu.pdfPageIndex !== null ? String(pu.pdfPageIndex) : "",
              );
              fd.set("presetSnapshot", pu.presetSnapshot);
              return saveSongPageImageFromForm(fd);
            });
            Promise.allSettled(uploadPromises).then((results) => {
              const failed = results.filter(
                (r) =>
                  r.status === "rejected" ||
                  (r.status === "fulfilled" && !r.value.success),
              );
              if (failed.length > 0) {
                console.error(
                  `[PDF Export] ${failed.length}/${results.length} page image uploads failed`,
                );
              }
            });
          })
          .catch((err) => {
            console.error(
              "[PDF Export] Failed to clean up old page images:",
              err,
            );
          });
      } else {
        toast.error(result.error ?? "PDF 생성 중 오류가 발생했습니다");
      }
    } catch (error) {
      console.error("[PDF Export] Export failed:", error);
      toast.error("PDF 생성 중 오류가 발생했습니다");
    } finally {
      setExporting(false);
    }
  }

  return {
    exporting,
    pdfUrl,
    handleExport,
  };
}
