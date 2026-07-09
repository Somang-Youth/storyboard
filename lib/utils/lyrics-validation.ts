export interface LyricsWarning {
  type: 'no-line-break' | 'line-too-long' | 'too-many-lines'
  message: string
}

export const MAX_LINE_VISUAL_LENGTH = 23
const MAX_LINE_COUNT = 3

const HANGUL_REGEX = /[가-힣]/
const LATIN_OR_DIGIT_REGEX = /[A-Za-z0-9]/
const WHITESPACE_REGEX = /\s/
const PAGE_BOUNDARY_CONTINUATION_ENDINGS = [
  '지만',
  '는데',
  '은데',
  '아도',
  '어도',
  '여도',
  '라도',
  '져도',
]

export function getLyricsLineVisualLength(line: string): number {
  let length = 0

  for (const char of line) {
    if (HANGUL_REGEX.test(char)) {
      length += 1
    } else if (WHITESPACE_REGEX.test(char)) {
      length += 0.3
    } else if (LATIN_OR_DIGIT_REGEX.test(char)) {
      length += 0.7
    } else {
      length += 1
    }
  }

  return Number(length.toFixed(10))
}

function isLineTooLong(line: string): boolean {
  return getLyricsLineVisualLength(line) > MAX_LINE_VISUAL_LENGTH
}

function getNormalizedLyricsLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function stripLineEndingPunctuation(line: string): string {
  return line.trim().replace(/[.,!?;:…，。！？]+$/g, '')
}

function needsFollowingPhrase(line: string): boolean {
  const normalized = stripLineEndingPunctuation(line)
  return PAGE_BOUNDARY_CONTINUATION_ENDINGS.some((ending) => normalized.endsWith(ending))
}

function getMaxVisualLength(lines: string[]): number {
  return Math.max(...lines.map(getLyricsLineVisualLength))
}

function getVisualLengthBalance(lines: string[]): number {
  const [first = '', second = ''] = lines
  return Math.abs(getLyricsLineVisualLength(first) - getLyricsLineVisualLength(second))
}

export function normalizeGeneratedLyricsPage(text: string): string {
  const lines = getNormalizedLyricsLines(text)

  if (lines.length !== 3) {
    return lines.join('\n')
  }

  const candidates = [
    [`${lines[0]} ${lines[1]}`, lines[2]],
    [lines[0], `${lines[1]} ${lines[2]}`],
  ].filter((candidate) => candidate.every((line) => !isLineTooLong(line)))

  if (candidates.length === 0) {
    return lines.join('\n')
  }

  candidates.sort((a, b) => {
    const maxDifference = getMaxVisualLength(a) - getMaxVisualLength(b)
    if (maxDifference !== 0) return maxDifference

    return getVisualLengthBalance(a) - getVisualLengthBalance(b)
  })

  return candidates[0].join('\n')
}

export function normalizeGeneratedLyricsPages(pages: string[]): string[] {
  const pageLines = pages
    .map((page) => getNormalizedLyricsLines(normalizeGeneratedLyricsPage(page)))
    .filter((lines) => lines.length > 0)

  for (let index = 0; index < pageLines.length - 1; index += 1) {
    const current = pageLines[index]
    const next = pageLines[index + 1]
    if (current.length !== 2 || next.length === 0) continue
    if (!needsFollowingPhrase(current[1])) continue

    const mergedCurrentLine = `${current[0]} ${current[1]}`
    const rebalancedCurrent = [mergedCurrentLine, next[0]]
    if (rebalancedCurrent.some(isLineTooLong)) continue

    pageLines[index] = rebalancedCurrent
    pageLines[index + 1] = next.slice(1)
  }

  return pageLines
    .map((lines) => lines.join('\n'))
    .filter(Boolean)
}

export function validateLyricsPage(text: string): LyricsWarning[] {
  if (!text.trim()) return []

  const warnings: LyricsWarning[] = []
  const lines = text.split('\n')
  const hasLineBreaks = lines.length > 1

  if (!hasLineBreaks) {
    if (isLineTooLong(text)) {
      warnings.push({
        type: 'no-line-break',
        message: '줄바꿈이 필요합니다',
      })
    }
  } else {
    if (lines.some(isLineTooLong)) {
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

export function flattenLyricsPageToLine(page: string): string {
  return page
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

export function canMergeLyricsPages(first: string, second: string): boolean {
  return (
    !isLineTooLong(flattenLyricsPageToLine(first))
    && !isLineTooLong(flattenLyricsPageToLine(second))
  )
}

export function mergeLyricsPages(first: string, second: string): string {
  return [flattenLyricsPageToLine(first), flattenLyricsPageToLine(second)]
    .filter(Boolean)
    .join('\n')
}
