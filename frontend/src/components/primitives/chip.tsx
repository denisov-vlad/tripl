import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

export type ChipTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info"
export type ChipVariant = "soft" | "outline"
export type ChipSize = "xs" | "sm" | "md"

type ChipProps = {
  children?: ReactNode
  tone?: ChipTone
  variant?: ChipVariant
  icon?: ReactNode
  size?: ChipSize
  className?: string
  style?: CSSProperties
  title?: string
}

const TONE_BG: Record<ChipTone, string> = {
  neutral: "var(--surface-hover)",
  accent: "var(--accent-soft)",
  success: "var(--success-soft)",
  warning: "var(--warning-soft)",
  danger: "var(--danger-soft)",
  info: "var(--info-soft)",
}

const TONE_FG: Record<ChipTone, string> = {
  neutral: "var(--fg-muted)",
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
}

export function Chip({
  children,
  tone = "neutral",
  variant = "soft",
  icon,
  size = "sm",
  className,
  style,
  title,
}: ChipProps) {
  const bg = variant === "outline" && tone === "neutral" ? "transparent" : TONE_BG[tone]
  const fg = TONE_FG[tone]
  const h = size === "xs" ? 18 : size === "md" ? 24 : 20
  const pad = size === "xs" ? "0 6px" : size === "md" ? "0 10px" : "0 7px"
  const fs = size === "xs" ? 10.5 : size === "md" ? 12 : 11

  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 font-medium leading-none whitespace-nowrap rounded-full", className)}
      style={{
        height: h,
        padding: pad,
        fontSize: fs,
        background: bg,
        color: fg,
        border: variant === "outline" ? `1px solid ${tone === "neutral" ? "var(--border)" : fg}` : "none",
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  )
}
