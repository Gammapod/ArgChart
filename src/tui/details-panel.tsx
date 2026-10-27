import { usePlugin } from "@opencode/plugin/tui"
import { For } from "solid-js"
import type { CommunicationGraph, GraphEdge } from "../domain.js"

export function DetailsPanel(props: { nodeID: string; relationships: readonly GraphEdge[]; constraints: CommunicationGraph["constraints"] }) {
  const context = usePlugin()
  const constraints = () => props.constraints.filter((constraint) => constraint.target === props.nodeID)
  return (
    <box flexDirection="column" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.muted}>DETAILS · {props.nodeID}</text>
      <For each={props.relationships}>
        {(edge) => <text fg={context.theme.text.base}>{edge.source} → {edge.target}: {edge.explanation.summary}</text>}
      </For>
      <For each={constraints()}>{(constraint) => <text fg={context.theme.text.feedback.warning.base}>{constraint.summary}</text>}</For>
    </box>
  )
}
