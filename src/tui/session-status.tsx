import { usePlugin } from "@opencode/plugin/tui"
import type { ActivitySession } from "../domain.js"

export type PermissionState = "none" | "pending" | "unknown"

/** Compact runtime state shared by agent and relationship status columns. */
export function SessionStatus(props: { session?: ActivitySession; active: boolean; permission: PermissionState }) {
  const context = usePlugin()
  const label = () => !props.session ? "—"
    : props.permission === "pending" ? "● approval"
      : props.permission === "unknown" ? "? approval"
        : props.active ? "● running"
          : props.session.outcome ?? "recent"
  const color = () => props.permission === "pending" || props.permission === "unknown" ? context.theme.text.feedback.warning.base
    : props.active ? context.theme.text.feedback.success.base
      : props.session?.outcome === "failed" ? context.theme.text.feedback.error.base
        : props.session?.outcome === "interrupted" ? context.theme.text.feedback.warning.base
          : context.theme.text.muted
  return <text width={14} fg={color()}>{label()}</text>
}
