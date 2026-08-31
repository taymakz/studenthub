// Chart text is localized for the fa-IR template: Jalali (Persian) calendar
// dates and Persian digits everywhere axis labels and tooltips are rendered.
export const shortDateFmt = new Intl.DateTimeFormat("fa-IR", {
  month: "short",
  day: "numeric",
})

export const weekdayDateFmt = new Intl.DateTimeFormat("fa-IR", {
  weekday: "short",
  month: "short",
  day: "numeric",
})

export const hmsTimeFmt = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("fa-IR").format
