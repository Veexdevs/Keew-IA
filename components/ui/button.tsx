"use client";

import { forwardRef } from "react";

type Variant = "primary" | "ghost" | "outline" | "subtle" | "danger";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:brightness-110 shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset,0_6px_18px_-8px_rgb(var(--glow)/0.75)]",
  outline:
    "border border-line bg-transparent text-fg hover:border-line-strong hover:bg-elev",
  ghost: "text-muted hover:bg-elev hover:text-fg",
  subtle: "bg-elev text-fg hover:brightness-110 border border-line",
  danger: "bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2 text-[11px] gap-1.5 rounded-[var(--r-sm)]",
  sm: "h-8 px-2.5 text-[12px] gap-1.5 rounded-[var(--r-sm)]",
  md: "h-10 px-4 text-[13px] gap-2 rounded-[var(--r-md)]",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ variant = "outline", size = "sm", className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex select-none items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
});
