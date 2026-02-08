"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { ko } from "date-fns/locale/ko"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon } from "@hugeicons/core-free-icons"

interface DatePickerProps {
  value: string // YYYY-MM-DD format
  onChange: (date: string) => void
  className?: string
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert YYYY-MM-DD string to Date object
  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Convert Date to YYYY-MM-DD string
      const formattedDate = format(date, "yyyy-MM-dd")
      onChange(formattedDate)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          {value ? (
            format(selectedDate!, "yyyy년 MM월 dd일", { locale: ko })
          ) : (
            <span>날짜를 선택하세요</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={ko}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
