import { usePlugin } from "@opencode/plugin/tui"

/** Placeholder dashboard region for the M6 tool-scope projection. */
export function ToolsPanel() {
  const context = usePlugin()
  return (
    <box flexDirection="column" width="35%" height="100%" overflow="scroll" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.muted}>TOOLS</text>
      <text fg={context.theme.text.muted}>Tool-scope explorer planned.</text>
      <text fg={context.theme.text.muted}>Shell, skills, MCP, glob, and grep will appear here.</text>
    </box>
  )
}
