import { usePlugin } from "@opencode/plugin/tui"
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { SessionMessageInfo } from "@opencode/client"
import type { ActivitySnapshot, CommunicationGraph, FileScopeDirectory } from "./domain.js"
import { ArgChartRPC } from "./rpc.js"
import { buildCommunicationTopology, defaultTopologyFilters, filterTopology, listLocalRelationships } from "./topology.js"
import { AgentNavigator } from "./tui/agent-navigator.js"
import { emptySelection, focusAgent, moveFocusedAgent, reconcileSelection } from "./tui/selection.js"
import { RelationshipsPanel } from "./tui/relationships-panel.js"
import { FileScopePanel } from "./tui/file-scope-panel.js"
import { buildFileScopeTree, clampFileScopeSelection } from "./tui/file-scope-tree.js"
import { AgentContextPanel } from "./tui/agent-context-panel.js"
import { CurrentSessionPanel } from "./tui/current-session-panel.js"
import type { PermissionState } from "./tui/session-status.js"
import { editIsMorePermissive, formatMatchingRule } from "./tui/file-scope-details.js"
import { delegatingAgentID, latestObservedChildSession, latestSessionForAgent } from "./activity.js"
import { latestSessionPreviewTurn } from "./session-preview.js"

export function ArgChartViewer() {
  const context = usePlugin()
  const client = context.client.rpc(ArgChartRPC)
  const [graph, setGraph] = createSignal<CommunicationGraph>()
  const [activity, setActivity] = createSignal<ActivitySnapshot>()
  const [activeSessionIDs, setActiveSessionIDs] = createSignal<ReadonlySet<string>>(new Set())
  const [permissionStates, setPermissionStates] = createSignal<ReadonlyMap<string, PermissionState>>(new Map())
  const [selection, updateSelection] = context.storage.memory("selection", { initial: emptySelection })
  const [error, setError] = createSignal<string>()
  const [fileScopes, setFileScopes] = createSignal<Record<string, FileScopeDirectory>>({})
  const [expandedFileScopePaths, setExpandedFileScopePaths] = createSignal<ReadonlySet<string>>(new Set())
  const [loadingFileScopePaths, setLoadingFileScopePaths] = createSignal<ReadonlySet<string>>(new Set())
  const [activePanel, setActivePanel] = createSignal<"agents" | "file-scope" | "relationships">("agents")
  const [fileScopeEntryIndex, setFileScopeEntryIndex] = createSignal(0)
  const [relationshipIndex, setRelationshipIndex] = createSignal(0)
  const [sessionMessages, setSessionMessages] = createSignal<readonly SessionMessageInfo[]>([])
  const [filters, updateFilters] = context.storage.memory("topology-filters", { initial: defaultTopologyFilters })
  const [followRunningAgents, updateFollowRunningAgents] = context.storage.memory("follow-running-agents", { initial: { enabled: true } })

  const selected = createMemo(() => graph()?.nodes.find((node) => node.id === selection.focusedAgentID))
  const topology = createMemo(() => graph() ? filterTopology(buildCommunicationTopology(graph()!), filters) : undefined)
  const relationships = createMemo(() => selected() && topology() ? listLocalRelationships(topology()!, selected()!.id) : undefined)
  const visibleFileEntries = createMemo(() => buildFileScopeTree(fileScopes(), expandedFileScopePaths(), loadingFileScopePaths()))
  const selectedSession = createMemo(() => {
    const agent = selected()
    return agent ? latestSessionForAgent(activity()?.sessions ?? [], activeSessionIDs(), agent.id) : undefined
  })
  const sessionPreview = createMemo(() => latestSessionPreviewTurn(sessionMessages()))
  const sessionPreviewHeader = createMemo(() => {
    const session = selectedSession()
    const nodes = graph()?.nodes ?? []
    const nameFor = (agentID: string | undefined, fallback: string) => nodes.find((node) => node.id === agentID)?.name ?? agentID ?? fallback
    return {
      promptSender: !session || !session.parentID ? "USER" : nameFor(delegatingAgentID(session, activity()?.sessions ?? []), "PARENT AGENT"),
      responseSender: session ? nameFor(session.agentID, selected()?.name ?? "AGENT") : selected()?.name ?? "AGENT",
      sessionTitle: session?.title,
    }
  })
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

  const syncCurrentSessionMessages = async () => {
    const session = selectedSession()
    if (!session) {
      setSessionMessages([])
      return
    }
    await context.data.session.message.sync(session.id)
    if (selectedSession()?.id === session.id) setSessionMessages(context.data.session.message.list(session.id))
  }

  createEffect(() => {
    setSessionMessages([])
    void syncCurrentSessionMessages().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to load current session messages.")
    })
  })

  createEffect(() => {
    const count = relationships()?.length ?? 0
    setRelationshipIndex((current) => Math.min(current, Math.max(0, count - 1)))
  })

  createEffect(() => {
    const entries = visibleFileEntries()
    setFileScopeEntryIndex((current) => clampFileScopeSelection(current, entries))
  })

  const selectRunningSessionAgent = (snapshot: ActivitySnapshot, active: ReadonlySet<string>, sessionID?: string) => {
    if (!followRunningAgents.enabled || !sessionID || !active.has(sessionID)) return
    const agentID = snapshot.sessions.find((session) => session.id === sessionID)?.agentID
    const currentGraph = graph()
    if (!agentID || !currentGraph?.nodes.some((node) => node.id === agentID)) return
    updateSelection((current) => {
      const next = focusAgent(current, agentID)
      current.selectedAgentIDs = next.selectedAgentIDs
      current.focusedAgentID = next.focusedAgentID
    })
  }

  const refreshActivity = async (runningSessionID?: string, permissionSessionID?: string) => {
    const [activitySnapshot, active] = await Promise.all([
      client["activity.refresh"]({}, { location: context.location }) as Promise<ActivitySnapshot>,
      context.client.session.active(),
    ])
    const activeSessionIDs = new Set(Object.keys(active))
    const permissionSessionIDs = new Set([...activeSessionIDs, ...(permissionSessionID ? [permissionSessionID] : [])])
    const permissionResults = await Promise.all([...permissionSessionIDs].map(async (sessionID) => {
      try {
        await context.data.session.permission.sync(sessionID)
        return [sessionID, context.data.session.permission.list(sessionID)?.length ? "pending" : "none"] as const
      } catch {
        return [sessionID, "unknown"] as const
      }
    }))
    setActivity(activitySnapshot)
    setActiveSessionIDs(activeSessionIDs)
    setPermissionStates(new Map(permissionResults))
    selectRunningSessionAgent(activitySnapshot, activeSessionIDs, runningSessionID)
  }

  const refresh = async () => {
    try {
      setError(undefined)
      const [result] = await Promise.all([
        client["graph.refresh"]({}, { location: context.location }) as Promise<CommunicationGraph>,
        refreshActivity(),
      ])
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

  const refreshActivityAfterSessionChange = (runningSessionID?: string, permissionSessionID?: string) => {
    void refreshActivity(runningSessionID, permissionSessionID).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to refresh session activity.")
    })
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

  const openFocusedAgentSession = () => {
    const agent = selected()
    const session = agent && latestSessionForAgent(activity()?.sessions ?? [], activeSessionIDs(), agent.id)
    if (session) context.ui.router.navigate({ type: "session", sessionID: session.id })
    else context.ui.toast.show({ message: "No recent session is available for this agent.", variant: "warning" })
  }

  const openFocusedRelationshipSession = () => {
    const agent = selected()
    const relationship = relationships()?.[relationshipIndex()]
    const session = agent && relationship && latestObservedChildSession(
      activity()?.sessions ?? [], activeSessionIDs(), activity()?.observedChildSessions ?? [], agent.id, relationship.node.id,
    )
    if (session) context.ui.router.navigate({ type: "session", sessionID: session.id })
    else context.ui.toast.show({ message: "No observed child session is available for this relationship.", variant: "warning" })
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
      { id: "argchart.viewer.toggle-follow-running", title: "Toggle follow running agents", bind: "w", run: () => updateFollowRunningAgents((setting) => { setting.enabled = !setting.enabled }) },
      { id: "argchart.viewer.focus-agents", title: "Focus ArgChart agent navigator", bind: "g", run: () => setActivePanel("agents") },
      { id: "argchart.viewer.focus-file-scope", title: "Focus ArgChart file scope", bind: "f", run: () => setActivePanel("file-scope") },
      { id: "argchart.viewer.focus-relationships", title: "Focus ArgChart relationships", bind: "l", run: () => setActivePanel("relationships") },
      { id: "argchart.viewer.open-status-session", title: "Open the selected ArgChart status session", bind: "enter", run: () => {
        if (activePanel() === "agents") openFocusedAgentSession()
        else if (activePanel() === "relationships") openFocusedRelationshipSession()
        else toggleFocusedFileScopeDirectory()
      } },
      { id: "argchart.viewer.file-scope-info", title: "Show selected file-scope details", bind: "i", run: showFocusedFileScopeInfo },
      { id: "argchart.viewer.file-scope-expand-exceptions", title: "Expand file-scope directories with nested exceptions", bind: "x", run: expandExceptionFileScopeDirectories },
      { id: "argchart.viewer.file-scope-collapse-all", title: "Collapse all file-scope directories", bind: "c", run: collapseAllFileScopeDirectories },
    ],
  }))

  onMount(() => {
    void refresh()
    let timer: ReturnType<typeof setTimeout> | undefined
    let messageTimer: ReturnType<typeof setTimeout> | undefined
    let runningSessionID: string | undefined
    let permissionSessionID: string | undefined
    const scheduleActivityRefresh = (sessionID?: string, pendingSessionID?: string) => {
      if (sessionID) runningSessionID = sessionID
      if (pendingSessionID) permissionSessionID = pendingSessionID
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const selectedSessionID = runningSessionID
        const selectedPermissionSessionID = permissionSessionID
        runningSessionID = undefined
        permissionSessionID = undefined
        refreshActivityAfterSessionChange(selectedSessionID, selectedPermissionSessionID)
      }, 150)
    }
    const scheduleCurrentSessionMessageRefresh = (sessionID: string) => {
      if (sessionID !== selectedSession()?.id) return
      if (messageTimer) clearTimeout(messageTimer)
      messageTimer = setTimeout(() => {
        void syncCurrentSessionMessages().catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Unable to refresh current session messages.")
        })
      }, 100)
    }
    const stops = [
      context.data.on("session.created", () => scheduleActivityRefresh()),
      context.data.on("session.agent.selected", () => scheduleActivityRefresh()),
      context.data.on("session.execution.started", (event) => scheduleActivityRefresh(event.data.sessionID)),
      context.data.on("session.execution.succeeded", () => scheduleActivityRefresh()),
      context.data.on("session.execution.failed", () => scheduleActivityRefresh()),
      context.data.on("session.execution.interrupted", () => scheduleActivityRefresh()),
      context.data.on("session.status", (event) => scheduleActivityRefresh(event.data.status.type === "busy" ? event.data.sessionID : undefined)),
      context.data.on("session.idle", () => scheduleActivityRefresh()),
      context.data.on("permission.asked", (event) => scheduleActivityRefresh(undefined, event.data.sessionID)),
      context.data.on("permission.replied", (event) => scheduleActivityRefresh(undefined, event.data.sessionID)),
      context.data.on("session.text.delta", (event) => scheduleCurrentSessionMessageRefresh(event.data.sessionID)),
      context.data.on("session.text.ended", (event) => scheduleCurrentSessionMessageRefresh(event.data.sessionID)),
    ]
    onCleanup(() => {
      if (timer) clearTimeout(timer)
      if (messageTimer) clearTimeout(messageTimer)
      stops.forEach((stop) => stop())
    })
  })

  return (
    <box flexDirection="column" height="100%" padding={1} gap={1}>
      <box justifyContent="space-between">
        <text fg={context.theme.text.base}>ArgChart · {selected()?.name ?? "no agent selected"}</text>
        <text fg={context.theme.text.muted}>
          filters: subagents {filters.showSubagents ? "on" : "off"} · ask {filters.showAskEdges ? "on" : "off"} · deny {filters.showDenyEdges ? "on" : "off"} · pending {[...permissionStates().values()].filter((state) => state === "pending").length} · unknown {[...permissionStates().values()].filter((state) => state === "unknown").length} · follow running {followRunningAgents.enabled ? "on" : "off"} · w toggle · r refresh · {activePanel() === "agents" ? "agents" : activePanel() === "file-scope" ? "files" : "relationships"} focus
        </text>
      </box>
      <Show when={error()}>{(message) => <text fg={context.theme.text.feedback.error.base}>{message()}</text>}</Show>
      <Show when={graph()} fallback={<text fg={context.theme.text.muted}>Loading graph…</text>}>
        {(currentGraph) => <>
          <box flexDirection="row" gap={2} flexGrow={1} overflow="hidden">
            <AgentNavigator graph={currentGraph()} sessions={activity()?.sessions ?? []} activeSessionIDs={activeSessionIDs()} permissionStates={permissionStates()} focusedAgentID={selection.focusedAgentID} focused={activePanel() === "agents"} />
            <box flexDirection="column" flexGrow={1} overflow="hidden" gap={1}>
              <box flexDirection="row" height={21} flexShrink={0} overflow="hidden" gap={1}>
                <Show when={relationships()}>{(items) => <RelationshipsPanel agentID={selected()!.id} relationships={items()} sessions={activity()?.sessions ?? []} observedChildSessions={activity()?.observedChildSessions ?? []} activeSessionIDs={activeSessionIDs()} permissionStates={permissionStates()} focused={activePanel() === "relationships"} focusedIndex={relationshipIndex()} />}</Show>
                <Show when={selected()}>{(node) => <AgentContextPanel node={node()} />}</Show>
              </box>
              <box flexDirection="row" flexGrow={1} overflow="hidden" gap={1}>
                <Show when={fileScopes()[""]} fallback={<text fg={context.theme.text.muted}>Loading file scope…</text>}>
                  {(scope) => <FileScopePanel scope={scope()} entries={visibleFileEntries()} focused={activePanel() === "file-scope"} focusedIndex={fileScopeEntryIndex()} />}
                </Show>
                <CurrentSessionPanel {...sessionPreviewHeader()} sessionID={selectedSession()?.id} turn={sessionPreview()} />
              </box>
            </box>
          </box>
        </>}
      </Show>
    </box>
  )
}
