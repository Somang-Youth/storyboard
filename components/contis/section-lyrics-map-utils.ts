type SectionLyricsMap = Record<number, number[]>

function cloneSectionLyricsMap(sectionLyricsMap: SectionLyricsMap): SectionLyricsMap {
  const next: SectionLyricsMap = {}

  for (const [sectionIndex, lyricsIndices] of Object.entries(sectionLyricsMap)) {
    next[Number(sectionIndex)] = [...lyricsIndices]
  }

  return next
}

function areSectionLyricsMapsEqual(left: SectionLyricsMap, right: SectionLyricsMap) {
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)

  if (leftEntries.length !== rightEntries.length) {
    return false
  }

  return leftEntries.every(([sectionIndex, leftLyricsIndices]) => {
    const rightLyricsIndices = right[Number(sectionIndex)]
    return (
      rightLyricsIndices !== undefined
      && leftLyricsIndices.length === rightLyricsIndices.length
      && leftLyricsIndices.every((lyricsIndex, index) => lyricsIndex === rightLyricsIndices[index])
    )
  })
}

export function addLyricsPageToSection(
  sectionLyricsMap: SectionLyricsMap,
  sectionIndex: number,
  lyricsIndex: number,
): SectionLyricsMap {
  const next = cloneSectionLyricsMap(sectionLyricsMap)

  next[sectionIndex] = [...(sectionLyricsMap[sectionIndex] ?? []), lyricsIndex]

  return next
}

export function removeLyricsPageOccurrence(
  sectionLyricsMap: SectionLyricsMap,
  sectionIndex: number,
  occurrenceIndex: number,
): SectionLyricsMap {
  const next = cloneSectionLyricsMap(sectionLyricsMap)
  const lyricsIndices = sectionLyricsMap[sectionIndex] ?? []

  const nextLyricsIndices = lyricsIndices.filter((_, index) => index !== occurrenceIndex)

  if (nextLyricsIndices.length === 0) {
    delete next[sectionIndex]
  } else {
    next[sectionIndex] = nextLyricsIndices
  }

  return next
}

export function moveLyricsPageOccurrence(
  sectionLyricsMap: SectionLyricsMap,
  sectionIndex: number,
  occurrenceIndex: number,
  direction: "up" | "down",
): SectionLyricsMap {
  const lyricsIndices = sectionLyricsMap[sectionIndex] ?? []
  const targetIndex = direction === "up" ? occurrenceIndex - 1 : occurrenceIndex + 1

  if (
    occurrenceIndex < 0
    || occurrenceIndex >= lyricsIndices.length
    || targetIndex < 0
    || targetIndex >= lyricsIndices.length
  ) {
    return sectionLyricsMap
  }

  const next = cloneSectionLyricsMap(sectionLyricsMap)
  const nextLyricsIndices = [...lyricsIndices]

  ;[nextLyricsIndices[occurrenceIndex], nextLyricsIndices[targetIndex]] = [
    nextLyricsIndices[targetIndex],
    nextLyricsIndices[occurrenceIndex],
  ]
  next[sectionIndex] = nextLyricsIndices

  return next
}

export function pruneInvalidLyricsPages(
  sectionLyricsMap: SectionLyricsMap,
  lyricsCount: number,
): SectionLyricsMap {
  const next: SectionLyricsMap = {}

  for (const [sectionIndex, lyricsIndices] of Object.entries(sectionLyricsMap)) {
    const validLyricsIndices = lyricsIndices.filter(
      (lyricsIndex) => lyricsIndex >= 0 && lyricsIndex < lyricsCount,
    )

    if (validLyricsIndices.length > 0) {
      next[Number(sectionIndex)] = validLyricsIndices
    }
  }

  return areSectionLyricsMapsEqual(sectionLyricsMap, next) ? sectionLyricsMap : next
}

export function shiftSectionLyricsMapForRemoval(
  sectionLyricsMap: SectionLyricsMap,
  removedIndex: number,
): SectionLyricsMap {
  const next: SectionLyricsMap = {}

  for (const [sectionIndex, lyricsIndices] of Object.entries(sectionLyricsMap)) {
    const shifted = lyricsIndices
      .filter((lyricsIndex) => lyricsIndex !== removedIndex)
      .map((lyricsIndex) => (lyricsIndex > removedIndex ? lyricsIndex - 1 : lyricsIndex))

    if (shifted.length > 0) {
      next[Number(sectionIndex)] = shifted
    }
  }

  return next
}

export function mergeSectionLyricsMapPages(
  sectionLyricsMap: SectionLyricsMap,
  keptIndex: number,
): SectionLyricsMap {
  const absorbedIndex = keptIndex + 1
  const next: SectionLyricsMap = {}

  for (const [sectionIndex, lyricsIndices] of Object.entries(sectionLyricsMap)) {
    const remapped: number[] = []

    lyricsIndices.forEach((lyricsIndex, occurrence) => {
      // 흔한 (kept, absorbed) 인접쌍만 단일 페이지 참조로 축약하고
      // 그 외 위치의 의도적 반복 참조는 보존한다.
      const isMergeAdjacency =
        lyricsIndex === absorbedIndex
        && occurrence > 0
        && lyricsIndices[occurrence - 1] === keptIndex

      if (isMergeAdjacency) {
        return
      }

      if (lyricsIndex === absorbedIndex) {
        remapped.push(keptIndex)
      } else if (lyricsIndex > absorbedIndex) {
        remapped.push(lyricsIndex - 1)
      } else {
        remapped.push(lyricsIndex)
      }
    })

    if (remapped.length > 0) {
      next[Number(sectionIndex)] = remapped
    }
  }

  return next
}
