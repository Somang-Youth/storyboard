import type * as PdfjsLib from 'pdfjs-dist'

let pdfjsPromise: Promise<typeof PdfjsLib> | null = null

export function initPdfjs(): Promise<typeof PdfjsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      return lib
    })
  }
  return pdfjsPromise
}

// Start loading pdfjs + worker immediately when this module is imported in the browser,
// so by the time a component's useEffect fires, it's likely already ready.
if (typeof window !== 'undefined') {
  initPdfjs()
}

export async function getPdfPageCount(url: string): Promise<number> {
  const pdfjsLib = await initPdfjs()
  const doc = await pdfjsLib.getDocument(url).promise
  const count = doc.numPages
  doc.destroy()
  return count
}

/**
 * Render multiple pages from a single PDF, reusing one document instance.
 * Returns an array of data URLs in page order.
 */
export async function renderPdfPagesToDataUrls(
  url: string,
  pageNums: number[],
  scale: number = 2,
): Promise<string[]> {
  const pdfjsLib = await initPdfjs()
  const doc = await pdfjsLib.getDocument(url).promise
  const results: string[] = []

  for (const pageNum of pageNums) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    results.push(canvas.toDataURL('image/png'))
  }

  doc.destroy()
  return results
}

export async function renderPdfPageToDataUrl(
  url: string,
  pageNum: number,
  scale: number = 2,
): Promise<string> {
  const [dataUrl] = await renderPdfPagesToDataUrls(url, [pageNum], scale)
  return dataUrl
}
