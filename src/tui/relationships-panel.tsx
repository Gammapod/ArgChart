import { usePlugin } from "@opencode/plugin/tui"
import { createEffect, For } from "solid-js"
import type { EdgeDecision } from "../domain.js"
import type { LocalTopologyNeighbor } from "../topology.js"

const symbol: Record<EdgeDecision, string> = { allow: "✓", ask: "?", deny: "×" }

/** Compact, row-oriented projection of the selected agent's visible relationships. */
export function RelationshipsPanel(props: { relationships: readonly LocalTopologyNeighbor[]; focused: boolean; focusedIndex: number }) {
  const context = usePlugin()
  let scrollbox: { scrollChildIntoView(childID: string): void } | undefined
  const inboundCount = () => props.relationships.filter((relationship) => relationship.inbound).length
  const outboundCount = () => props.relationships.filter((relationship) => relationship.outbound).length
  createEffect(() => {
    if (props.focused) scrollbox?.scrollChildIntoView(`argchart-relationship-row-${props.focusedIndex}`)
  })
  return (
    <scrollbox ref={(value) => { scrollbox = value }} contentOptions={{ flexDirection: "column" }} flexGrow={1} height="100%" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={props.focused ? context.theme.text.action.primary.base : context.theme.text.muted}>RELATIONSHIPS · CALLS ME ({inboundCount()}) · I CAN CALL ({outboundCount()}) · l focus · j/k select</text>
      <box flexDirection="row">
        <text width={28} fg={context.theme.text.muted}>AGENT</text>
        <text width={14} fg={context.theme.text.muted}>CALLS ME</text>
        <text width={14} fg={context.theme.text.muted}>I CAN CALL</text>
      </box>
      <For each={props.relationships} fallback={<text fg={context.theme.text.muted}>No visible delegation relationships.</text>}>
        {(relationship, index) => <RelationshipRow relationship={relationship} index={index()} selected={props.focused && index() === props.focusedIndex} />}
      </For>
    </scrollbox>
  )
}

function RelationshipRow(props: { relationship: LocalTopologyNeighbor; index: number; selected: boolean }) {
  const context = usePlugin()
  const label = () => props.relationship.node.kind === "user" ? "User" : props.relationship.node.label
  return (
    <box id={`argchart-relationship-row-${props.index}`} flexDirection="row">
      <text width={28} fg={props.selected || props.relationship.node.kind === "user" ? context.theme.text.action.primary.base : context.theme.text.base}>{props.selected ? "› " : "  "}{truncate(label(), 25)}</text>
      <Decision edge={props.relationship.inbound?.decision} />
      <Decision edge={props.relationship.outbound?.decision} />
    </box>
  )
}

function Decision(props: { edge?: EdgeDecision }) {
  const context = usePlugin()
  if (!props.edge) return <text width={14} fg={context.theme.text.muted}>---</text>
  const color = props.edge === "allow" ? context.theme.text.feedback.success.base
    : props.edge === "ask" ? context.theme.text.feedback.warning.base
      : context.theme.text.feedback.error.base
  return <text width={14} fg={color}>{symbol[props.edge]} {props.edge}</text>
}

function truncate(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}
