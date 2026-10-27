import { usePlugin } from "@opencode/plugin/tui"
import { For } from "solid-js"
import type { EdgeDecision, GraphEdge, GraphNode } from "../domain.js"

const decisionSymbol: Record<EdgeDecision, string> = { allow: "✓", ask: "?", deny: "×" }

export function RelationshipPanel(props: { selected: GraphNode; relationships: readonly GraphEdge[] }) {
  const context = usePlugin()
  return (
    <box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.base}>RELATIONSHIPS · {props.selected.name}</text>
      <For each={props.relationships} fallback={<text fg={context.theme.text.muted}>No callable subagent relationships.</text>}>
        {(edge) => <Relationship edge={edge} selectedID={props.selected.id} />}
      </For>
    </box>
  )
}

function Relationship(props: { edge: GraphEdge; selectedID: string }) {
  const context = usePlugin()
  const direction = props.edge.source === props.selectedID ? `${props.edge.source} → ${props.edge.target}` : `${props.edge.source} → ${props.edge.target} (inbound)`
  const color = props.edge.decision === "allow"
    ? context.theme.text.feedback.success.base
    : props.edge.decision === "deny"
      ? context.theme.text.feedback.error.base
      : context.theme.text.feedback.warning.base
  return <text fg={color}>{decisionSymbol[props.edge.decision]} {direction}{props.edge.wildcardDerived ? " · wildcard" : ""}</text>
}
