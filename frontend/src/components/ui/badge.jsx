import * as React from "react"
import { Slot } from "radix-ui"

import { badgeVariants } from "@/components/ui/badge-variants"
import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props} />
  );
}

export { Badge }
