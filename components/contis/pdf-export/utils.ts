export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${year}년 ${month}월 ${day}일`;
}

export async function applySavedCrop(
  originalUrl: string,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for crop"));
    img.src = originalUrl;
  });

  const sx = Math.round(cropX * img.naturalWidth);
  const sy = Math.round(cropY * img.naturalHeight);
  const sw = Math.round(cropWidth * img.naturalWidth);
  const sh = Math.round(cropHeight * img.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png");
}
