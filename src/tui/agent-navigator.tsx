import type { CommunicationGraph } from "../domain.js"
import { latestSessionForAgent } from "../activity.js"
import type { ActivitySession } from "../domain.js"
import { SessionStatus, type PermissionState } from "./session-status.js"
import { usePlugin } from "@opencode/plugin/tui"
import { For } from "solid-js"

export function AgentNavigator(props: {
  graph: CommunicationGraph
  sessions: readonly ActivitySession[]
  activeSessionIDs: ReadonlySet<string>
  permissionStates: ReadonlyMap<string, PermissionState>
  focusedAgentID?: string
  focused: boolean
}) {
  const context = usePlugin()

  return (
    <box flexDirection="column" width={47} height="100%" overflow="scroll" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={props.focused ? context.theme.text.action.primary.base : context.theme.text.muted}>AGENTS ({props.graph.nodes.length}) · g focus · enter open status session</text>
      <box flexDirection="row">
        <text width={19} fg={context.theme.text.muted}>NAME</text>
        <text width={10} fg={context.theme.text.muted}>MODE</text>
        <text width={14} fg={context.theme.text.muted}>STATUS</text>
      </box>
      <For each={props.graph.nodes}>
        {(node) => <AgentRow node={node} sessions={props.sessions} activeSessionIDs={props.activeSessionIDs} permissionStates={props.permissionStates} focused={node.id === props.focusedAgentID} />}
      </For>
    </box>
  )
}

function AgentRow(props: { node: CommunicationGraph["nodes"][number]; sessions: readonly ActivitySession[]; activeSessionIDs: ReadonlySet<string>; permissionStates: ReadonlyMap<string, PermissionState>; focused: boolean }) {
  const context = usePlugin()
  const session = () => latestSessionForAgent(props.sessions, props.activeSessionIDs, props.node.id)
  return (
    <box flexDirection="row">
      <text width={19} fg={props.focused ? context.theme.text.action.primary.base : context.theme.text.base}>{props.focused ? "› " : "  "}{truncate(props.node.name, 17)}</text>
      <text width={10} fg={context.theme.text.muted}>{props.node.mode}</text>
      <SessionStatus session={session()} active={session() !== undefined && props.activeSessionIDs.has(session()!.id)} permission={session() ? props.permissionStates.get(session()!.id) ?? "none" : "none"} />
    </box>
  )
}

function truncate(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}
