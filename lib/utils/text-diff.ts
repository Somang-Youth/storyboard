import { diffWordsWithSpace } from 'diff'

export interface DiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

export function computeWordDiff(original: string, corrected: string): DiffPart[] {
  return diffWordsWithSpace(original, corrected)
}

export function getOriginalParts(parts: DiffPart[]): DiffPart[] {
  return parts.filter(p => !p.added)
}

export function getCorrectedParts(parts: DiffPart[]): DiffPart[] {
  return parts.filter(p => !p.removed)
}
