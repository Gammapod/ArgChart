import type { CommunicationGraph } from "../domain.js"
import { usePlugin } from "@opencode/plugin/tui"
import { For } from "solid-js"

export function AgentNavigator(props: { graph: CommunicationGraph; focusedAgentID?: string }) {
  const context = usePlugin()

  return (
    <box flexDirection="column" width={34} height="100%" overflow="scroll" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.muted}>AGENTS ({props.graph.nodes.length})</text>
      <box flexDirection="row">
        <text width={20} fg={context.theme.text.muted}>NAME</text>
        <text width={10} fg={context.theme.text.muted}>MODE</text>
      </box>
      <For each={props.graph.nodes}>
        {(node) => (
          <box flexDirection="row">
            <text width={20} fg={node.id === props.focusedAgentID ? context.theme.text.action.primary.base : context.theme.text.base}>
              {node.id === props.focusedAgentID ? "› " : "  "}{truncate(node.name, 18)}
            </text>
            <text width={10} fg={context.theme.text.muted}>{node.mode}</text>
          </box>
        )}
      </For>
    </box>
  )
}

function truncate(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}
