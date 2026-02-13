export interface LyricsWarning {
  type: 'no-line-break' | 'line-too-long' | 'too-many-lines'
  message: string
}

const MAX_LINE_LENGTH = 25
const MAX_LINE_COUNT = 3

export function validateLyricsPage(text: string): LyricsWarning[] {
  if (!text.trim()) return []

  const warnings: LyricsWarning[] = []
  const lines = text.split('\n')
  const hasLineBreaks = lines.length > 1

  if (!hasLineBreaks) {
    if (text.length >= MAX_LINE_LENGTH) {
      warnings.push({
        type: 'no-line-break',
        message: '줄바꿈이 필요합니다',
      })
    }
  } else {
    if (lines.some(line => line.length >= MAX_LINE_LENGTH)) {
      warnings.push({
        type: 'line-too-long',
        message: '줄이 너무 깁니다',
      })
    }

    if (lines.length >= MAX_LINE_COUNT) {
      warnings.push({
        type: 'too-many-lines',
        message: '줄 수가 너무 많습니다',
      })
    }
  }

  return warnings
}
