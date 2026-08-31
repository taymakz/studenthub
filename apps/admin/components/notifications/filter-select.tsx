"use client"

import * as React from "react"

import { Label } from "@workspace/ui/components/label"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@workspace/ui/components/combobox"

export const ALL = "همه"

export function handleMultiChange(
  prev: string[],
  next: string[] | null,
  setter: (v: string[]) => void,
  allValue: string = ALL
) {
  const vals = (next ?? []) as string[]
  if (vals.includes(allValue)) {
    if (vals.length > 1 && !prev.includes(allValue)) {
      setter([allValue])
    } else if (vals.includes(allValue) && vals.length > 1) {
      setter(vals.filter((v) => v !== allValue))
    } else {
      setter(vals.length ? vals : [allValue])
    }
  } else {
    if (vals.length === 0) setter([allValue])
    else setter(vals)
  }
}

export interface FilterSelectProps {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  items: string[]
  getLabel?: (item: string) => string
  placeholder?: string
}

export function FilterSelect({
  label,
  value,
  onChange,
  items,
  getLabel,
  placeholder = "همه",
}: FilterSelectProps) {
  const renderLabel = getLabel ?? ((v: string) => v)
  const onValueChange = (next: unknown) => {
    handleMultiChange(value, next as string[] | null, onChange, ALL)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Combobox
        items={items}
        multiple
        value={value}
        onValueChange={onValueChange}
      >
        <ComboboxChips className="min-h-9">
          <ComboboxValue>
            {(selected: string[]) =>
              selected.map((item) => (
                <ComboboxChip key={item}>{renderLabel(item)}</ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput placeholder={placeholder} />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>یافت نشد</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {renderLabel(item)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
