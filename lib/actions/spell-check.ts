'use server'

import type { ActionResult } from '@/lib/types'

// -- Types --

interface SpellCheckResult {
  original: string
  corrected: string
  errorCount: number
}

// -- Constants --

const NAVER_SEARCH_URL = 'https://m.search.naver.com/search.naver?query=맞춤법검사기'
const NAVER_SPELLER_URL = 'https://m.search.naver.com/p/csearch/ocontent/util/SpellerProxy'
const NAVER_MAX_CHARS = 300
const NAVER_REQUEST_DELAY = 500 // ms between requests
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Module-level cache
let cachedPassportKey: string | null = null

// -- Helper: sleep --
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// -- Helper: getPassportKey --
// Fetches Naver search HTML and extracts the dynamic passportKey via regex
async function getPassportKey(): Promise<string> {
  const response = await fetch(NAVER_SEARCH_URL, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!response.ok) {
    throw new Error('네이버 검색 페이지에 접근할 수 없습니다')
  }
  const html = await response.text()
  const match = html.match(/SpellerProxy\?passportKey=([a-zA-Z0-9]+)/)
  if (!match) {
    throw new Error('passportKey를 가져올 수 없습니다')
  }
  cachedPassportKey = match[1]
  return cachedPassportKey
}

// -- Helper: unescapeHtml --
// Naver response contains HTML entities that need unescaping
function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<br\s*\/?>/g, '\n')
}

// -- Helper: chunkText --
// Splits text into chunks <= maxChars, respecting line and word boundaries
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  const lines = text.split('\n')
  let current = ''

  for (const line of lines) {
    if (line.length > maxChars) {
      if (current) { chunks.push(current); current = '' }
      let remaining = line
      while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
          current = remaining
          break
        }
        const chunk = remaining.slice(0, maxChars)
        const lastSpace = chunk.lastIndexOf(' ')
        if (lastSpace > maxChars * 0.5) {
          chunks.push(remaining.slice(0, lastSpace))
          remaining = remaining.slice(lastSpace + 1)
        } else {
          chunks.push(chunk)
          remaining = remaining.slice(maxChars)
        }
      }
    } else if ((current + '\n' + line).length > maxChars) {
      chunks.push(current)
      current = line
    } else {
      current += (current ? '\n' : '') + line
    }
  }
  if (current) chunks.push(current)
  return chunks
}

// -- Helper: callNaverSpellCheck --
// Calls Naver SpellerProxy for a single chunk
async function callNaverSpellCheck(text: string, passportKey: string): Promise<{
  notag_html: string
  errata_count: number
}> {
  const url = new URL(NAVER_SPELLER_URL)
  url.searchParams.set('passportKey', passportKey)
  url.searchParams.set('color_blindness', '0')
  url.searchParams.set('q', text)

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': 'https://search.naver.com/',
    },
  })

  if (!response.ok) {
    throw new Error(`Naver API error: ${response.status}`)
  }

  const data = await response.json()

  if (data.message?.error) {
    throw new Error(data.message.error)
  }

  const result = data.message?.result
  if (!result) {
    throw new Error('네이버 맞춤법 검사 응답이 올바르지 않습니다')
  }

  return {
    notag_html: result.notag_html ?? '',
    errata_count: result.errata_count ?? 0,
  }
}

// -- Main exported server action --
export async function checkSpelling(text: string): Promise<ActionResult<SpellCheckResult>> {
  try {
    if (!text.trim()) {
      return {
        success: true,
        data: { original: text, corrected: text, errorCount: 0 },
      }
    }

    // Get passportKey (use cached or fetch new)
    if (!cachedPassportKey) {
      await getPassportKey()
    }

    const chunks = chunkText(text, NAVER_MAX_CHARS)
    const correctedChunks: string[] = []
    let totalErrors = 0

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await sleep(NAVER_REQUEST_DELAY)

      let result: { notag_html: string; errata_count: number }

      try {
        result = await callNaverSpellCheck(chunks[i], cachedPassportKey!)
      } catch {
        // passportKey might have expired — refresh and retry once
        await getPassportKey()
        result = await callNaverSpellCheck(chunks[i], cachedPassportKey!)
      }

      correctedChunks.push(unescapeHtml(result.notag_html))
      totalErrors += result.errata_count
    }

    // Join chunks back together preserving the original line structure
    const corrected = correctedChunks.join('\n')

    return {
      success: true,
      data: {
        original: text,
        corrected,
        errorCount: totalErrors,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
    return {
      success: false,
      error: `맞춤법 검사 중 오류가 발생했습니다: ${message}`,
    }
  }
}
