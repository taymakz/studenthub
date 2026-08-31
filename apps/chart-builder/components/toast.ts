import { toastManager as base } from "@workspace/ui/components/toast"

/** Every builder toast renders in the compact "x" pill style; injected
    here so call sites can't forget it. `data` persists across
    toastManager.update, so loading→result flows keep the variant. */
export const toastManager: typeof base = {
  ...base,
  add: (options) =>
    base.add({
      ...options,
      data: { variant: "x", ...options.data },
    }),
}
