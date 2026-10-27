import { usePlugin } from "@opencode/plugin/tui"
import { For, Show } from "solid-js"
import type { EdgeDecision } from "../domain.js"
import type { LocalTopologyNeighbor, LocalTopologyLayout, TopologyEdge, TopologyFilters } from "../topology.js"
import type { GraphNode } from "../domain.js"

export function TopologyPanel(props: { selected: GraphNode; layout: LocalTopologyLayout; filters: TopologyFilters }) {
  const context = usePlugin()
  return (
    <box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.muted}>
        LOCAL TOPOLOGY · solid allow · dashed ask · subagents {props.filters.showSubagents ? "shown" : "hidden"} · ask {props.filters.showAskEdges ? "shown" : "hidden"} · deny {props.filters.showDenyEdges ? "shown" : "hidden"}
      </text>
      <box flexDirection="row" gap={1}>
        <box flexDirection="column" width={28}>
          <text fg={context.theme.text.muted}>INBOUND</text>
          <For each={props.layout.inbound} fallback={<text fg={context.theme.text.muted}>—</text>}>
            {(neighbor) => <InboundNeighbor neighbor={neighbor} />}
          </For>
        </box>
        <box flexDirection="column" width={18} justifyContent="center" alignItems="center" borderStyle="single" borderColor={context.theme.text.action.primary.base} padding={1}>
          <text fg={context.theme.text.action.primary.base}>[{props.selected.name}]</text>
          <text fg={context.theme.text.muted}>{props.selected.mode}</text>
        </box>
        <box flexDirection="column" flexGrow={1} alignItems="flex-end">
          <text fg={context.theme.text.muted}>OUTBOUND / TWO-WAY</text>
          <For each={props.layout.outbound} fallback={<text fg={context.theme.text.muted}>—</text>}>
            {(neighbor) => <OutboundNeighbor neighbor={neighbor} />}
          </For>
        </box>
      </box>
    </box>
  )
}

function InboundNeighbor(props: { neighbor: LocalTopologyNeighbor }) {
  const context = usePlugin()
  const edge = () => props.neighbor.inbound!
  return <box flexDirection="row"><text>[{props.neighbor.node.label}] </text><text fg={edgeColor(context, edge().decision)}>{arrow(edge(), "right")}</text></box>
}

function OutboundNeighbor(props: { neighbor: LocalTopologyNeighbor }) {
  const context = usePlugin()
  const outbound = () => props.neighbor.outbound!
  const inbound = () => props.neighbor.inbound
  return (
    <box flexDirection="row">
      <Show when={inbound()}>{(edge) => <text fg={edgeColor(context, edge().decision)}>{arrow(edge(), "left")} </text>}</Show>
      <text fg={edgeColor(context, outbound().decision)}>{arrow(outbound(), "right")}</text>
      <text> [{props.neighbor.node.label}]</text>
    </box>
  )
}

function edgeColor(context: ReturnType<typeof usePlugin>, decision: EdgeDecision) {
  return decision === "ask"
    ? context.theme.text.feedback.warning.base
    : decision === "deny"
      ? context.theme.text.feedback.error.base
      : context.theme.text.feedback.success.base
}

function arrow(edge: TopologyEdge, direction: "left" | "right"): string {
  const line = edge.decision === "ask" ? "- -" : "──"
  return direction === "right" ? `${line}▶` : `◀${line}`
}
