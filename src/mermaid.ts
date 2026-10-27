import type { CommunicationGraph } from "./domain.js"
import { buildCommunicationTopology, defaultTopologyFilters, filterTopology, type TopologyFilters } from "./topology.ts"

export function toMermaid(graph: CommunicationGraph, filters: TopologyFilters = defaultTopologyFilters): string {
  const topology = filterTopology(buildCommunicationTopology(graph), filters)
  const identifiers = new Map(topology.nodes.map((node, index) => [node.id, `n${index}`]))
  const nodeLines = topology.nodes.map((node) => `  ${identifiers.get(node.id)}["${escapeLabel(node.label)}"]`)
  const edgeLines = topology.edges.map((edge) => {
    const arrow = edge.decision === "allow" ? "-->" : "-.->"
    return `  ${identifiers.get(edge.source)} ${arrow}|${edge.decision}| ${identifiers.get(edge.target)}`
  })
  const user = identifiers.get("argchart:user")

  return [
    "%% ArgChart effective runtime communication graph",
    `%% Generated: ${graph.generatedAt}`,
    "flowchart TD",
    ...nodeLines,
    ...edgeLines,
    `  class ${user} user`,
    "  classDef user fill:#2563eb,color:#ffffff,stroke:#1d4ed8",
    "  %% Solid edges allow; dashed edges ask or deny. Edge labels preserve the decision.",
    "",
  ].join("\n")
}

function escapeLabel(value: string): string {
  return value.replace(/"/g, "&quot;")
}
