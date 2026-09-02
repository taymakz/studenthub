"use client"

import { Search } from "lucide-react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"

export function ListSearch({ value, onChange, resultCount }: { value: string; onChange: (v: string) => void; resultCount: number }) {
  return (
    <InputGroup className="h-11 rounded-xl">
      <InputGroupInput
        placeholder="جستجو…"
        type="search"
        name="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        aria-label="جستجو"
        className="text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">{resultCount} نتیجه</InputGroupAddon>
    </InputGroup>
  )
}
