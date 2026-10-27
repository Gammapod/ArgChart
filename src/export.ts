import { join } from "node:path"
import { writeFile } from "node:fs/promises"
import type { AgentInventory } from "./domain.js"
import { analyzeCommunicationGraph } from "./graph.js"
import { toMermaid } from "./mermaid.js"
import { defaultTopologyFilters, type TopologyFilters } from "./topology.js"

export async function exportMermaidGraph(inventory: AgentInventory, directory: string, filters?: TopologyFilters): Promise<{ outputPath: string }> {
  const outputPath = join(directory, "argchart.mmd")
  await writeFile(outputPath, toMermaid(analyzeCommunicationGraph(inventory), filters), "utf8")
  return { outputPath }
}

export function normalizeTopologyFilters(value: unknown): TopologyFilters {
  if (!value || typeof value !== "object") return defaultTopologyFilters
  const input = value as Partial<TopologyFilters>

  return {
    showSubagents: typeof input.showSubagents === "boolean" ? input.showSubagents : defaultTopologyFilters.showSubagents,
    showAskEdges: typeof input.showAskEdges === "boolean" ? input.showAskEdges : defaultTopologyFilters.showAskEdges,
    showDenyEdges: typeof input.showDenyEdges === "boolean" ? input.showDenyEdges : defaultTopologyFilters.showDenyEdges,
  }
}
