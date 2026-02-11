'use server'

import type { ActionResult } from '@/lib/types'

interface OcrResult {
  texts: string[]
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4MB limit for inline base64

export async function extractTextFromRegions(
  regions: { imageDataUrl: string }[]
): Promise<ActionResult<OcrResult>> {
  try {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: 'Google Cloud Vision API 키가 설정되지 않았습니다. .env.local에 GOOGLE_CLOUD_VISION_API_KEY를 추가해주세요.',
      }
    }

    if (regions.length === 0) {
      return {
        success: false,
        error: '선택된 영역이 없습니다.',
      }
    }

    // Process all regions in parallel
    const results = await Promise.all(
      regions.map(async (region, index) => {
        // Strip data URL prefix to get raw base64
        const base64Match = region.imageDataUrl.match(/^data:[^;]+;base64,(.+)$/)
        if (!base64Match) {
          throw new Error(`영역 ${index + 1}: 올바른 이미지 데이터가 아닙니다.`)
        }
        const base64Content = base64Match[1]

        // Check approximate decoded size
        const approxBytes = base64Content.length * 0.75
        if (approxBytes > MAX_IMAGE_BYTES) {
          throw new Error(`영역 ${index + 1}: 이미지 크기가 너무 큽니다. 더 작은 영역을 선택해주세요. (최대 4MB)`)
        }

        const response = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [
                {
                  image: { content: base64Content },
                  features: [{ type: 'TEXT_DETECTION' }],
                },
              ],
            }),
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = (errorData as Record<string, unknown>)?.error
            ? String((errorData as Record<string, { message?: string }>).error?.message || response.statusText)
            : response.statusText
          throw new Error(`영역 ${index + 1}: Google Vision API 오류 (${response.status}): ${errorMessage}`)
        }

        const data = await response.json()
        const annotation = data.responses?.[0]

        if (annotation?.error) {
          throw new Error(`영역 ${index + 1}: ${annotation.error.message}`)
        }

        const extractedText = annotation?.fullTextAnnotation?.text
          ?? annotation?.textAnnotations?.[0]?.description
          ?? ''

        return extractedText.trim()
      })
    )

    return {
      success: true,
      data: { texts: results },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
    return {
      success: false,
      error: `OCR 텍스트 추출 중 오류가 발생했습니다: ${message}`,
    }
  }
}
