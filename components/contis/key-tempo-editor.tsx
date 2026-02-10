"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon } from "@hugeicons/core-free-icons"
interface KeyTempoEditorProps {
  initialKeys: string[]
  initialTempos: number[]
  onChange: (data: { keys: string[]; tempos: number[] }) => void
}

const COMMON_KEYS = ["C", "D", "E", "F", "G", "A", "B"]

export function KeyTempoEditor({
  initialKeys,
  initialTempos,
  onChange,
}: KeyTempoEditorProps) {
  const [keys, setKeys] = useState<string[]>(initialKeys)
  const [tempos, setTempos] = useState<number[]>(initialTempos)

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onChangeRef.current({ keys, tempos })
  }, [keys, tempos])

  const addKey = (key?: string) => {
    setKeys([...keys, key ?? ""])
  }

  const removeKey = (index: number) => {
    setKeys(keys.filter((_, i) => i !== index))
  }

  const updateKey = (index: number, value: string) => {
    const newKeys = [...keys]
    newKeys[index] = value
    setKeys(newKeys)
  }

  const addTempo = () => {
    setTempos([...tempos, 120])
  }

  const removeTempo = (index: number) => {
    setTempos(tempos.filter((_, i) => i !== index))
  }

  const updateTempo = (index: number, value: number) => {
    const newTempos = [...tempos]
    newTempos[index] = value
    setTempos(newTempos)
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-base font-medium">조성 (키)</label>
          <Button size="xs" onClick={() => addKey()}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            추가
          </Button>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5">
          {COMMON_KEYS.map((key) => (
            <Badge
              key={key}
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() => addKey(key)}
            >
              {key}
            </Badge>
          ))}
        </div>

        <div className="space-y-2">
          {keys.map((key, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={key}
                onChange={(e) => updateKey(index, e.target.value)}
                placeholder="예: G, Ab, F#m"
                className="flex-1"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => removeKey(index)}
                aria-label="삭제"
              >
                <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
              </Button>
            </div>
          ))}
          {keys.length === 0 && (
            <p className="text-muted-foreground text-base">
              조성을 추가하세요
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-base font-medium">템포 (BPM)</label>
          <Button size="xs" onClick={addTempo}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            추가
          </Button>
        </div>

        <div className="space-y-2">
          {tempos.map((tempo, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="number"
                value={tempo}
                onChange={(e) => updateTempo(index, parseInt(e.target.value) || 0)}
                placeholder="120"
                className="flex-1"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => removeTempo(index)}
                aria-label="삭제"
              >
                <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
              </Button>
            </div>
          ))}
          {tempos.length === 0 && (
            <p className="text-muted-foreground text-base">
              템포를 추가하세요
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
