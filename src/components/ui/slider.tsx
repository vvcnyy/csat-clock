import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/utils";

export function Slider({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn("ui-slider", className)} {...props}>
      <SliderPrimitive.Track className="ui-slider-track">
        <SliderPrimitive.Range className="ui-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="ui-slider-thumb" />
    </SliderPrimitive.Root>
  );
}
