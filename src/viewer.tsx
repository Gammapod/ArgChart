import { usePlugin } from "@opencode/plugin/tui"
import { Show, createMemo, createSignal, onMount } from "solid-js"
import type { CommunicationGraph } from "./domain.js"
import { ArgChartRPC } from "./rpc.js"
import { buildCommunicationTopology, defaultTopologyFilters, filterTopology, layoutLocalTopology } from "./topology.js"
import { AgentNavigator } from "./tui/agent-navigator.js"
import { DetailsPanel } from "./tui/details-panel.js"
import { RelationshipPanel } from "./tui/relationship-panel.js"
import { emptySelection, focusAgent, moveFocusedAgent, reconcileSelection } from "./tui/selection.js"
import { TopologyPanel } from "./tui/topology-panel.js"

export function ArgChartViewer() {
  const context = usePlugin()
  const client = context.client.rpc(ArgChartRPC)
  const [graph, setGraph] = createSignal<CommunicationGraph>()
  const [selection, updateSelection] = context.storage.memory("selection", { initial: emptySelection })
  const [error, setError] = createSignal<string>()
  const [filters, updateFilters] = context.storage.memory("topology-filters", { initial: defaultTopologyFilters })
  const [viewerOptions, updateViewerOptions] = context.storage.memory("viewer-options", { initial: { showDetails: true } })

  const selected = createMemo(() => graph()?.nodes.find((node) => node.id === selection.focusedAgentID))
  const relationships = createMemo(() => {
    const node = selected()
    return node ? graph()?.edges.filter((edge) => edge.source === node.id || edge.target === node.id) ?? [] : []
  })
  const topology = createMemo(() => graph() ? filterTopology(buildCommunicationTopology(graph()!), filters) : undefined)
  const localTopology = createMemo(() => selected() && topology() ? layoutLocalTopology(topology()!, selected()!.id) : undefined)

  const refresh = async () => {
    try {
      setError(undefined)
      const result = (await client["graph.refresh"]({}, { location: context.location })) as CommunicationGraph
      const isInitialLoad = graph() === undefined
      setGraph(result)
      updateSelection((current) => {
        const reconciled = reconcileSelection(result, current)
        const next = isInitialLoad && !reconciled.focusedAgentID ? focusAgent(reconciled, result.nodes[0]?.id) : reconciled
        current.selectedAgentIDs = next.selectedAgentIDs
        if (next.focusedAgentID === undefined) delete current.focusedAgentID
        else current.focusedAgentID = next.focusedAgentID
        if (next.focusedRelationship === undefined) delete current.focusedRelationship
        else current.focusedRelationship = next.focusedRelationship
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh the communication graph.")
    }
  }

  const moveSelection = (offset: number) => {
    const currentGraph = graph()
    if (!currentGraph) return
    updateSelection((current) => {
      const next = moveFocusedAgent(currentGraph, current, offset)
      current.selectedAgentIDs = next.selectedAgentIDs
      if (next.focusedAgentID === undefined) delete current.focusedAgentID
      else current.focusedAgentID = next.focusedAgentID
    })
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
        {(currentGraph) => <>
          <box flexDirection="row" gap={2} flexGrow={1}>
            <AgentNavigator graph={currentGraph()} focusedAgentID={selection.focusedAgentID} />
            <Show when={selected()} fallback={<text fg={context.theme.text.muted}>Select an agent to inspect its relationships.</text>}>
              {(node) => <RelationshipPanel selected={node()} relationships={relationships()} />}
            </Show>
          </box>
          <Show when={viewerOptions.showDetails}>
            <Show when={selected()}>
              {(node) => <DetailsPanel nodeID={node().id} relationships={relationships()} constraints={currentGraph().constraints} />}
            </Show>
          </Show>
          <Show when={selected()}>
            {(node) => <Show when={localTopology()}>
              {(layout) => <TopologyPanel selected={node()} layout={layout()} filters={filters} />}
            </Show>}
          </Show>
        </>}
      </Show>
    </box>
  )
}
