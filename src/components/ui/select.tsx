import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/utils";

export const Select = SelectPrimitive.Root;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger className={cn("ui-select-trigger", className)} {...props}>
      {children}
      <SelectPrimitive.Icon><ChevronDown size={16} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export const SelectValue = SelectPrimitive.Value;

export function SelectContent({ children }: { children: ReactNode }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className="ui-select-content"
        position="popper"
        sideOffset={6}
        align="start"
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item className={cn("ui-select-item", className)} {...props}>
      <SelectPrimitive.ItemText className="ui-select-item-text">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ui-select-item-indicator">
        <Check size={15} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
