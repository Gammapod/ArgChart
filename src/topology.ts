import type { CommunicationGraph, EdgeDecision } from "./domain.js"

export const USER_NODE_ID = "argchart:user"

export interface TopologyNode {
  id: string
  label: string
  kind: "user" | "agent"
  mode?: "primary" | "subagent" | "all"
}

export interface TopologyEdge {
  source: string
  target: string
  decision: EdgeDecision
  kind: "user-selection" | "subagent"
}

export interface CommunicationTopology {
  nodes: readonly TopologyNode[]
  edges: readonly TopologyEdge[]
}

export interface LocalTopologyNeighbor {
  node: TopologyNode
  inbound?: TopologyEdge
  outbound?: TopologyEdge
}

export interface LocalTopologyLayout {
  inbound: readonly LocalTopologyNeighbor[]
  outbound: readonly LocalTopologyNeighbor[]
}

export interface TopologyFilters {
  showSubagents: boolean
  showAskEdges: boolean
  showDenyEdges: boolean
}

export const defaultTopologyFilters: TopologyFilters = {
  showSubagents: false,
  showAskEdges: true,
  showDenyEdges: false,
}

export function buildCommunicationTopology(graph: CommunicationGraph): CommunicationTopology {
  return {
    nodes: [
      { id: USER_NODE_ID, label: "User", kind: "user" },
      ...graph.nodes.map((node) => ({ id: node.id, label: node.name, kind: "agent" as const, mode: node.mode })),
    ],
    edges: [
      ...graph.nodes
        .filter((node) => node.mode === "primary" || node.mode === "all")
        .map((node) => ({ source: USER_NODE_ID, target: node.id, decision: "allow" as const, kind: "user-selection" as const })),
      ...graph.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        decision: edge.decision,
        kind: "subagent" as const,
      })),
    ],
  }
}

export function filterTopology(topology: CommunicationTopology, filters: TopologyFilters): CommunicationTopology {
  const nodes = topology.nodes.filter((node) => filters.showSubagents || node.mode !== "subagent")
  const nodeIDs = new Set(nodes.map((node) => node.id))

  return {
    nodes,
    edges: topology.edges.filter((edge) =>
      nodeIDs.has(edge.source)
      && nodeIDs.has(edge.target)
      && (filters.showAskEdges || edge.decision !== "ask")
      && (filters.showDenyEdges || edge.decision !== "deny"),
    ),
  }
}

export function visibleTopologyEdges(topology: CommunicationTopology, selectedID: string): readonly TopologyEdge[] {
  return topology.edges.filter((edge) =>
    (edge.source === selectedID || edge.target === selectedID) && edge.decision !== "deny",
  )
}

export function layoutLocalTopology(topology: CommunicationTopology, selectedID: string): LocalTopologyLayout {
  const neighbors = new Map<string, LocalTopologyNeighbor>()
  const node = (id: string) => topology.nodes.find((candidate) => candidate.id === id)
  const ensure = (id: string) => {
    const existing = neighbors.get(id)
    if (existing) return existing
    const candidate = node(id)
    if (!candidate) return undefined
    const created: LocalTopologyNeighbor = { node: candidate }
    neighbors.set(id, created)
    return created
  }

  for (const edge of topology.edges) {
    if (edge.source === selectedID && edge.target !== selectedID) ensure(edge.target)!.outbound = edge
    if (edge.target === selectedID && edge.source !== selectedID) ensure(edge.source)!.inbound = edge
  }

  const compare = (left: LocalTopologyNeighbor, right: LocalTopologyNeighbor) => {
    if (left.node.id === USER_NODE_ID) return -1
    if (right.node.id === USER_NODE_ID) return 1
    return left.node.label.localeCompare(right.node.label)
  }
  const all = [...neighbors.values()]

  return {
    inbound: all.filter((neighbor) => neighbor.inbound && !neighbor.outbound).sort(compare),
    outbound: all.filter((neighbor) => neighbor.outbound).sort(compare),
  }
}
