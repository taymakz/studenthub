"use client"

import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

export interface GreetingConfigProps {
  include: boolean
  setInclude: (v: boolean) => void
  template: string
  setTemplate: (v: string) => void
  includeButton?: boolean
  setIncludeButton?: (v: boolean) => void
  idPrefix: string
  greetingLabel?: string
  buttonLabel?: string
  showHint?: boolean
}

export function GreetingConfig({
  include,
  setInclude,
  template,
  setTemplate,
  includeButton,
  setIncludeButton,
  idPrefix,
  greetingLabel = "سلام شخصی‌سازی شده",
  buttonLabel = "دکمه «اجرای برنامه»",
  showHint = false,
}: GreetingConfigProps) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-greet`}
          checked={include}
          onCheckedChange={(v) => setInclude(Boolean(v))}
        />
        <Label htmlFor={`${idPrefix}-greet`} className="text-xs font-medium">
          {greetingLabel}
        </Label>
        {showHint && (
          <span className="text-[11px] text-muted-foreground">
            — {"{name}"} → نام یا «دانشجوی عزیز»
          </span>
        )}
      </div>
      {include && (
        <div className="space-y-1.5 ps-6">
          <Label className="text-xs">
            قالب سلام — {"{name}"} جای نام می‌نشیند
          </Label>
          <Input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="سلام {name} عزیز"
            dir="rtl"
            className="font-sans"
          />
        </div>
      )}
      {typeof includeButton === "boolean" && setIncludeButton && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-btn`}
            checked={includeButton}
            onCheckedChange={(v) => setIncludeButton!(Boolean(v))}
          />
          <Label htmlFor={`${idPrefix}-btn`} className="text-xs">
            {buttonLabel}
          </Label>
        </div>
      )}
    </div>
  )
}

// Lightweight variant for the course detect card (border bg-card p-3)
export function GreetingConfigCompact(props: GreetingConfigProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${props.idPrefix}-greet`}
          checked={props.include}
          onCheckedChange={(v) => props.setInclude(Boolean(v))}
        />
        <Label htmlFor={`${props.idPrefix}-greet`} className="text-xs">
          {props.greetingLabel}
        </Label>
      </div>
      {props.include && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            قالب سلام — {"{name}"} جای نام می‌نشیند
          </Label>
          <Input
            value={props.template}
            onChange={(e) => props.setTemplate(e.target.value)}
            placeholder="سلام {name} عزیز"
            dir="rtl"
          />
        </div>
      )}
      {typeof props.includeButton === "boolean" && props.setIncludeButton && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${props.idPrefix}-btn`}
            checked={props.includeButton}
            onCheckedChange={(v) => props.setIncludeButton!(Boolean(v))}
          />
          <Label htmlFor={`${props.idPrefix}-btn`} className="text-xs">
            {props.buttonLabel}
          </Label>
        </div>
      )}
    </div>
  )
}
