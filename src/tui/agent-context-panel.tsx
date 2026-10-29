import { usePlugin } from "@opencode/plugin/tui"
import type { GraphNode } from "../domain.js"

/** Safe selected-agent metadata; raw instructions are intentionally excluded. */
export function AgentContextPanel(props: { node: GraphNode }) {
  const context = usePlugin()
  const model = props.node.model ? `${props.node.model.providerID}/${props.node.model.id}` : "runtime default"
  return (
    <box flexDirection="column" height={6} flexShrink={0} overflow="hidden" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.muted}>AGENT CONTEXT · INSTRUCTIONS NOT EXPOSED</text>
      <text fg={context.theme.text.base}>{props.node.name} · {props.node.mode} · {model}{props.node.hidden ? " · hidden" : ""}</text>
      <text fg={context.theme.text.muted}>{props.node.description ?? "No agent description supplied by the effective runtime."}</text>
    </box>
  )
}
