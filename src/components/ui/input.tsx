import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // The one text field: 44px tall, 16px radius, hairline border, no shadow.
        // min-w-0 + appearance-none let it shrink inside a grid cell (iOS date inputs won't otherwise).
        "h-11 w-full min-w-0 appearance-none rounded-lg border border-line bg-paper-card px-4 text-base text-ink outline-none transition-colors md:text-sm",
        "placeholder:text-ink-faint focus-visible:border-ink aria-invalid:border-destructive",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
