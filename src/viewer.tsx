import { usePlugin } from "@opencode/plugin/tui"
import { Show, createEffect, createMemo, createSignal, onMount } from "solid-js"
import type { CommunicationGraph, FileScopeDirectory } from "./domain.js"
import { ArgChartRPC } from "./rpc.js"
import { buildCommunicationTopology, defaultTopologyFilters, filterTopology, listLocalRelationships } from "./topology.js"
import { AgentNavigator } from "./tui/agent-navigator.js"
import { emptySelection, focusAgent, moveFocusedAgent, reconcileSelection } from "./tui/selection.js"
import { RelationshipsPanel } from "./tui/relationships-panel.js"
import { FileScopePanel } from "./tui/file-scope-panel.js"
import { buildFileScopeTree, clampFileScopeSelection } from "./tui/file-scope-tree.js"
import { AgentContextPanel } from "./tui/agent-context-panel.js"
import { ToolsPanel } from "./tui/tools-panel.js"
import { editIsMorePermissive, formatMatchingRule } from "./tui/file-scope-details.js"

export function ArgChartViewer() {
  const context = usePlugin()
  const client = context.client.rpc(ArgChartRPC)
  const [graph, setGraph] = createSignal<CommunicationGraph>()
  const [selection, updateSelection] = context.storage.memory("selection", { initial: emptySelection })
  const [error, setError] = createSignal<string>()
  const [fileScopes, setFileScopes] = createSignal<Record<string, FileScopeDirectory>>({})
  const [expandedFileScopePaths, setExpandedFileScopePaths] = createSignal<ReadonlySet<string>>(new Set())
  const [loadingFileScopePaths, setLoadingFileScopePaths] = createSignal<ReadonlySet<string>>(new Set())
  const [activePanel, setActivePanel] = createSignal<"agents" | "file-scope" | "relationships">("agents")
  const [fileScopeEntryIndex, setFileScopeEntryIndex] = createSignal(0)
  const [relationshipIndex, setRelationshipIndex] = createSignal(0)
  const [filters, updateFilters] = context.storage.memory("topology-filters", { initial: defaultTopologyFilters })

  const selected = createMemo(() => graph()?.nodes.find((node) => node.id === selection.focusedAgentID))
  const topology = createMemo(() => graph() ? filterTopology(buildCommunicationTopology(graph()!), filters) : undefined)
  const relationships = createMemo(() => selected() && topology() ? listLocalRelationships(topology()!, selected()!.id) : undefined)
  const visibleFileEntries = createMemo(() => buildFileScopeTree(fileScopes(), expandedFileScopePaths(), loadingFileScopePaths()))
  let scopedAgentID: string | undefined
  const fileScopeRequests = new Map<string, Promise<FileScopeDirectory | undefined>>()

  const loadFileScopeDirectory = (agentID: string, path: string): Promise<FileScopeDirectory | undefined> => {
    const existing = fileScopes()[path]
    if (existing) return Promise.resolve(existing)
    const requestKey = `${agentID}\0${path}`
    const pending = fileScopeRequests.get(requestKey)
    if (pending) return pending
    setLoadingFileScopePaths((current) => new Set(current).add(path))
    const request = client["file-scope.list"]({ agentID, path }, { location: context.location })
      .then((scope) => {
        const directory = scope as FileScopeDirectory
        if (selected()?.id === agentID) setFileScopes((current) => ({ ...current, [path]: directory }))
        return directory
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load file scope.")
        return undefined
      })
      .finally(() => {
        fileScopeRequests.delete(requestKey)
        setLoadingFileScopePaths((current) => {
        const next = new Set(current)
        next.delete(path)
        return next
        })
      })
    fileScopeRequests.set(requestKey, request)
    return request
  }

  const expandFileScopeDirectories = async (shouldExpand: (entry: FileScopeDirectory["entries"][number]) => boolean) => {
    const agent = selected()
    if (!agent) return
    const pendingPaths = [""]
    const visitedPaths = new Set<string>()
    while (pendingPaths.length) {
      const path = pendingPaths.pop()!
      if (visitedPaths.has(path)) continue
      visitedPaths.add(path)
      const scope = await loadFileScopeDirectory(agent.id, path)
      if (!scope || selected()?.id !== agent.id) return
      const directories = scope.entries.filter((entry) => entry.kind === "directory" && entry.exists && shouldExpand(entry))
      if (!directories.length) continue
      setExpandedFileScopePaths((current) => {
        const next = new Set(current)
        for (const directory of directories) next.add(directory.path)
        return next
      })
      pendingPaths.push(...directories.map((directory) => directory.path))
    }
  }

  const expandExceptionFileScopeDirectories = () => expandFileScopeDirectories((entry) => entry.readHasNestedException || entry.editHasNestedException)
  const collapseAllFileScopeDirectories = () => setExpandedFileScopePaths(new Set<string>())

  createEffect(() => {
    const agent = selected()
    if (!agent) {
      scopedAgentID = undefined
      setFileScopes({})
      return
    }
    if (scopedAgentID !== agent.id) {
      scopedAgentID = agent.id
      setFileScopes({})
      setExpandedFileScopePaths(new Set<string>())
      setLoadingFileScopePaths(new Set<string>())
      fileScopeRequests.clear()
      setFileScopeEntryIndex(0)
      void loadFileScopeDirectory(agent.id, "").then(() => expandExceptionFileScopeDirectories())
    }
  })

  createEffect(() => {
    const count = relationships()?.length ?? 0
    setRelationshipIndex((current) => Math.min(current, Math.max(0, count - 1)))
  })

  createEffect(() => {
    const entries = visibleFileEntries()
    setFileScopeEntryIndex((current) => clampFileScopeSelection(current, entries))
  })

  const refresh = async () => {
    try {
      setError(undefined)
      const result = (await client["graph.refresh"]({}, { location: context.location })) as CommunicationGraph
      const isInitialLoad = graph() === undefined
      // Refresh invalidates the server cache. Reset the client projection too,
      // even when the same agent remains focused.
      scopedAgentID = undefined
      setFileScopes({})
      setExpandedFileScopePaths(new Set<string>())
      setLoadingFileScopePaths(new Set<string>())
      fileScopeRequests.clear()
      setFileScopeEntryIndex(0)
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

  const moveFileScopeSelection = (offset: number) => {
    const entries = visibleFileEntries()
    if (!entries.length) return
    setFileScopeEntryIndex((current) => Math.max(0, Math.min(entries.length - 1, current + offset)))
  }

  const moveRelationshipSelection = (offset: number) => {
    const count = relationships()?.length ?? 0
    if (!count) return
    setRelationshipIndex((current) => Math.max(0, Math.min(count - 1, current + offset)))
  }

  const toggleFocusedFileScopeDirectory = () => {
    const entry = visibleFileEntries()[fileScopeEntryIndex()]
    if (!entry || entry.entry.kind !== "directory" || !entry.entry.exists) return
    setExpandedFileScopePaths((current) => {
      const next = new Set(current)
      if (next.has(entry.entry.path)) next.delete(entry.entry.path)
      else next.add(entry.entry.path)
      return next
    })
    if (!entry.expanded) void loadFileScopeDirectory(selected()!.id, entry.entry.path)
  }

  const showFocusedFileScopeInfo = async () => {
    const agent = selected()
    const treeEntry = visibleFileEntries()[fileScopeEntryIndex()]
    if (!agent || !treeEntry) {
      context.ui.toast.show({ message: "Focus File Scope and select a structure first.", variant: "warning" })
      return
    }
    const entry = treeEntry.entry
    const unusualEditAccess = editIsMorePermissive(entry.read, entry.edit)
    await context.ui.dialog.alert({
      title: `File scope · /${entry.path}`,
      message: [
        `Agent: ${agent.name} (${agent.id})`,
        `Structure: /${entry.path} · ${entry.kind}${entry.exists ? "" : " · possible future path"}`,
        "",
        `Read: ${entry.read.decision}`,
        formatMatchingRule(entry.read),
        "",
        `Edit: ${entry.edit.decision}`,
        formatMatchingRule(entry.edit),
        ...(unusualEditAccess ? ["", "Alert: Edit access is more permissive than read access."] : []),
      ].join("\n"),
    })
  }

  context.keymap.layer(() => ({
    commands: [
      { id: "argchart.viewer.next", title: "Next item in active ArgChart panel", bind: "j", run: () => activePanel() === "agents" ? moveSelection(1) : activePanel() === "file-scope" ? moveFileScopeSelection(1) : moveRelationshipSelection(1) },
      { id: "argchart.viewer.previous", title: "Previous item in active ArgChart panel", bind: "k", run: () => activePanel() === "agents" ? moveSelection(-1) : activePanel() === "file-scope" ? moveFileScopeSelection(-1) : moveRelationshipSelection(-1) },
      { id: "argchart.viewer.refresh", title: "Refresh ArgChart graph", bind: "r", run: refresh },
      { id: "argchart.viewer.toggle-subagents", title: "Toggle subagent nodes", bind: "s", run: () => updateFilters((current) => { current.showSubagents = !current.showSubagents }) },
      { id: "argchart.viewer.toggle-ask", title: "Toggle ask edges", bind: "a", run: () => updateFilters((current) => { current.showAskEdges = !current.showAskEdges }) },
      { id: "argchart.viewer.toggle-deny", title: "Toggle denied edges", bind: "d", run: () => updateFilters((current) => { current.showDenyEdges = !current.showDenyEdges }) },
      { id: "argchart.viewer.focus-agents", title: "Focus ArgChart agent navigator", bind: "g", run: () => setActivePanel("agents") },
      { id: "argchart.viewer.focus-file-scope", title: "Focus ArgChart file scope", bind: "f", run: () => setActivePanel("file-scope") },
      { id: "argchart.viewer.focus-relationships", title: "Focus ArgChart relationships", bind: "l", run: () => setActivePanel("relationships") },
      { id: "argchart.viewer.file-scope-toggle", title: "Expand or collapse selected file-scope directory", bind: "enter", run: toggleFocusedFileScopeDirectory },
      { id: "argchart.viewer.file-scope-info", title: "Show selected file-scope details", bind: "i", run: showFocusedFileScopeInfo },
      { id: "argchart.viewer.file-scope-expand-exceptions", title: "Expand file-scope directories with nested exceptions", bind: "x", run: expandExceptionFileScopeDirectories },
      { id: "argchart.viewer.file-scope-collapse-all", title: "Collapse all file-scope directories", bind: "c", run: collapseAllFileScopeDirectories },
    ],
  }))

  onMount(refresh)

  return (
    <box flexDirection="column" height="100%" padding={1} gap={1}>
      <box justifyContent="space-between">
        <text fg={context.theme.text.base}>ArgChart · {selected()?.name ?? "no agent selected"}</text>
        <text fg={context.theme.text.muted}>
          filters: subagents {filters.showSubagents ? "on" : "off"} · ask {filters.showAskEdges ? "on" : "off"} · deny {filters.showDenyEdges ? "on" : "off"} · r refresh · {activePanel() === "agents" ? "agents" : activePanel() === "file-scope" ? "files" : "relationships"} focus
        </text>
      </box>
      <Show when={error()}>{(message) => <text fg={context.theme.text.feedback.error.base}>{message()}</text>}</Show>
      <Show when={graph()} fallback={<text fg={context.theme.text.muted}>Loading graph…</text>}>
        {(currentGraph) => <>
          <box flexDirection="row" gap={2} flexGrow={1} overflow="hidden">
            <AgentNavigator graph={currentGraph()} focusedAgentID={selection.focusedAgentID} focused={activePanel() === "agents"} />
            <box flexDirection="column" flexGrow={1} overflow="hidden" gap={1}>
              <box flexDirection="row" height={21} flexShrink={0} overflow="hidden" gap={1}>
                <Show when={relationships()}>{(items) => <RelationshipsPanel relationships={items()} focused={activePanel() === "relationships"} focusedIndex={relationshipIndex()} />}</Show>
                <Show when={selected()}>{(node) => <AgentContextPanel node={node()} />}</Show>
              </box>
              <box flexDirection="row" flexGrow={1} overflow="hidden" gap={1}>
                <Show when={fileScopes()[""]} fallback={<text fg={context.theme.text.muted}>Loading file scope…</text>}>
                  {(scope) => <FileScopePanel scope={scope()} entries={visibleFileEntries()} focused={activePanel() === "file-scope"} focusedIndex={fileScopeEntryIndex()} />}
                </Show>
                <ToolsPanel />
              </box>
            </box>
          </box>
        </>}
      </Show>
    </box>
  )
}
