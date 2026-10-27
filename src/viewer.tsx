import { usePlugin } from "@opencode/plugin/tui"
import { For, Show, createMemo, createSignal, onMount } from "solid-js"
import type { CommunicationGraph, EdgeDecision, GraphEdge } from "./domain.js"
import { ArgChartRPC } from "./rpc.js"
import { buildCommunicationTopology, defaultTopologyFilters, filterTopology, layoutLocalTopology } from "./topology.js"
import type { LocalTopologyNeighbor, TopologyEdge } from "./topology.js"

const decisionSymbol: Record<EdgeDecision, string> = { allow: "✓", ask: "?", deny: "×" }

export function ArgChartViewer() {
  const context = usePlugin()
  const client = context.client.rpc(ArgChartRPC)
  const [graph, setGraph] = createSignal<CommunicationGraph>()
  const [selectedID, setSelectedID] = createSignal<string>()
  const [error, setError] = createSignal<string>()
  const [filters, updateFilters] = context.storage.memory("topology-filters", { initial: defaultTopologyFilters })
  const [viewerOptions, updateViewerOptions] = context.storage.memory("viewer-options", { initial: { showDetails: true } })

  const selected = createMemo(() => graph()?.nodes.find((node) => node.id === selectedID()) ?? graph()?.nodes[0])
  const relationships = createMemo(() => {
    const node = selected()
    if (!node) return []
    return graph()?.edges.filter((edge) => edge.source === node.id || edge.target === node.id) ?? []
  })
  const topology = createMemo(() => graph() ? filterTopology(buildCommunicationTopology(graph()!), filters) : undefined)
  const localTopology = createMemo(() => selected() && topology() ? layoutLocalTopology(topology()!, selected()!.id) : undefined)

  const refresh = async () => {
    try {
      setError(undefined)
      const result = (await client["graph.refresh"]({}, { location: context.location })) as CommunicationGraph
      setGraph(result)
      setSelectedID((current) => result.nodes.some((node) => node.id === current) ? current : result.nodes[0]?.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh the communication graph.")
    }
  }

  const moveSelection = (offset: number) => {
    const nodes = graph()?.nodes ?? []
    const current = nodes.findIndex((node) => node.id === selected()?.id)
    if (!nodes.length) return
    setSelectedID(nodes[(current + offset + nodes.length) % nodes.length].id)
  }

  context.keymap.layer(() => ({
    commands: [
      { id: "argchart.viewer.next", title: "Next ArgChart agent", bind: "j", run: () => moveSelection(1) },
      { id: "argchart.viewer.previous", title: "Previous ArgChart agent", bind: "k", run: () => moveSelection(-1) },
      { id: "argchart.viewer.refresh", title: "Refresh ArgChart graph", bind: "r", run: refresh },
      { id: "argchart.viewer.toggle-subagents", title: "Toggle subagent nodes", bind: "s", run: () => updateFilters((current) => { current.showSubagents = !current.showSubagents }) },
      { id: "argchart.viewer.toggle-ask", title: "Toggle ask edges", bind: "a", run: () => updateFilters((current) => { current.showAskEdges = !current.showAskEdges }) },
      { id: "argchart.viewer.toggle-deny", title: "Toggle denied edges", bind: "d", run: () => updateFilters((current) => { current.showDenyEdges = !current.showDenyEdges }) },
      { id: "argchart.viewer.toggle-details", title: "Toggle details panel", bind: "i", run: () => updateViewerOptions((options) => { options.showDetails = !options.showDetails }) },
    ],
  }))

  onMount(refresh)

  return (
    <box flexDirection="column" padding={1} gap={1}>
      <box justifyContent="space-between">
        <text fg={context.theme.text.base}>ArgChart · effective runtime communication graph</text>
        <text fg={context.theme.text.muted}>j/k select · r refresh · s/a/d filters · i details</text>
      </box>
      <Show when={error()}>{(message) => <text fg={context.theme.text.feedback.error.base}>{message()}</text>}</Show>
      <Show when={graph()} fallback={<text fg={context.theme.text.muted}>Loading graph…</text>}>
        <box flexDirection="row" gap={2} flexGrow={1}>
          <box flexDirection="column" width={22} borderStyle="single" borderColor={context.theme.border.base} padding={1}>
            <text fg={context.theme.text.muted}>AGENTS ({graph()!.nodes.length})</text>
            <For each={graph()!.nodes}>
              {(node) => (
                <text fg={node.id === selected()?.id ? context.theme.text.action.primary.base : context.theme.text.base}>
                  {node.id === selected()?.id ? "› " : "  "}{node.name} [{node.mode}]
                </text>
              )}
            </For>
          </box>
          <box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={context.theme.border.base} padding={1}>
            <Show when={selected()}>
              {(node) => <>
                <text fg={context.theme.text.base}>RELATIONSHIPS · {node().name}</text>
                <For each={relationships()} fallback={<text fg={context.theme.text.muted}>No callable subagent relationships.</text>}>
                  {(edge) => <Relationship edge={edge} selectedID={node().id} />}
                </For>
              </>}
            </Show>
          </box>
        </box>
        <Show when={viewerOptions.showDetails}>
          <Show when={selected()}>
            {(node) => <Details nodeID={node().id} relationships={relationships()} constraints={graph()!.constraints} />}
          </Show>
        </Show>
        <Show when={selected()}>
          {(node) => <Neighborhood selected={node()} layout={localTopology()!} filters={filters} />}
        </Show>
      </Show>
    </box>
  )
}

function Neighborhood(props: {
  selected: CommunicationGraph["nodes"][number]
  layout: ReturnType<typeof layoutLocalTopology>
  filters: typeof defaultTopologyFilters
}) {
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

function Details(props: { nodeID: string; relationships: readonly GraphEdge[]; constraints: CommunicationGraph["constraints"] }) {
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
