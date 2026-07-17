import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = ({
  className,
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) => (
  <label
    data-slot="label"
    className={cn(labelVariants(), className)}
    {...props}
  />
)

export { Label }
