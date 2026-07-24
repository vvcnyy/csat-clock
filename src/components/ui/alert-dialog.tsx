import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export function AlertDialogContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="ui-dialog-overlay" />
      <AlertDialogPrimitive.Content
        className={cn("ui-alert-dialog-content", className)}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-alert-dialog-header", className)} {...props} />;
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("ui-alert-dialog-title", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("ui-alert-dialog-description", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-alert-dialog-footer", className)} {...props} />;
}

export function AlertDialogCancel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button className={className} variant="outline" {...props} />
    </AlertDialogPrimitive.Cancel>
  );
}

export function AlertDialogAction({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button className={className} variant="destructive" {...props} />
    </AlertDialogPrimitive.Action>
  );
}
