import { useState, useCallback, useRef } from "react"

export function useUnsavedChanges<T>(initialValue: T) {
  const [isDirty, setIsDirty] = useState(false)
  const initialRef = useRef(initialValue)

  const markDirty = useCallback(() => {
    setIsDirty(true)
  }, [])

  const reset = useCallback((newInitial?: T) => {
    setIsDirty(false)
    if (newInitial !== undefined) {
      initialRef.current = newInitial
    }
  }, [])

  return { isDirty, markDirty, reset }
}
