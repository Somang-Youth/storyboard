"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon, Menu09Icon } from "@hugeicons/core-free-icons"
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { nanoid } from 'nanoid'

interface SectionOrderEditorProps {
  initialSectionOrder: string[]
  onChange: (data: { sectionOrder: string[] }) => void
}

interface SectionItem {
  id: string
  name: string
}

const PRESET_SECTIONS = [
  { label: "Intro", value: "Intro" },
  { label: "V", value: "V" },
  { label: "C", value: "C" },
  { label: "B", value: "B" },
  { label: "Outro", value: "Outro" },
  { label: "Interlude", value: "Interlude" },
]

interface SortableItemProps {
  item: SectionItem
  index: number
  onRemove: (id: string) => void
}

function SortableItem({ item, index, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ring-foreground/10 flex items-center gap-3 rounded-lg bg-muted px-4 py-2 ring-1 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <HugeiconsIcon
          icon={Menu09Icon}
          strokeWidth={2}
          className="size-5 text-muted-foreground"
        />
      </div>
      <span className="text-muted-foreground text-sm font-medium">
        {index}
      </span>
      <span className="text-base">{item.name}</span>
      <button
        onClick={() => onRemove(item.id)}
        className="text-muted-foreground hover:text-foreground ml-auto"
        aria-label="삭제"
      >
        <HugeiconsIcon
          icon={Delete01Icon}
          strokeWidth={2}
          className="size-5"
        />
      </button>
    </div>
  )
}

export function SectionOrderEditor({
  initialSectionOrder,
  onChange,
}: SectionOrderEditorProps) {
  const [items, setItems] = useState<SectionItem[]>(
    initialSectionOrder.map(name => ({ id: nanoid(), name }))
  )
  const [customSection, setCustomSection] = useState("")

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
    onChangeRef.current({ sectionOrder: items.map(i => i.name) })
  }, [items])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor)
  )

  const addSection = (section: string) => {
    if (section.trim()) {
      setItems([...items, { id: nanoid(), name: section.trim() }])
    }
  }

  const removeSection = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const addCustomSection = () => {
    if (customSection.trim()) {
      addSection(customSection)
      setCustomSection("")
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 text-base font-medium">프리셋 섹션</div>
        <div className="flex flex-wrap gap-2">
          {PRESET_SECTIONS.map((preset) => (
            <Badge
              key={preset.value}
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() => addSection(preset.value)}
            >
              {preset.label}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 text-base font-medium">커스텀 섹션</div>
        <div className="flex gap-3">
          <Input
            value={customSection}
            onChange={(e) => setCustomSection(e.target.value)}
            placeholder="섹션 이름 입력"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCustomSection()
              }
            }}
          />
          <Button size="sm" onClick={addCustomSection}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            추가
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-3 text-base font-medium">섹션 순서</div>
        {items.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {items.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={removeSection}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-muted-foreground text-base">섹션을 추가하세요</p>
        )}
      </div>
    </div>
  )
}
