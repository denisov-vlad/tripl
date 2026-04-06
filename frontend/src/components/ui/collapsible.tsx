import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root
const CollapsibleTrigger = CollapsiblePrimitive.Trigger
const CollapsibleContent = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ ...props }, ref) => (
  <CollapsiblePrimitive.Content ref={ref} {...props} />
))
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
