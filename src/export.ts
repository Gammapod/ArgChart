import { join } from "node:path"
import { access, writeFile } from "node:fs/promises"
import type { AgentInventory } from "./domain.js"
import { analyzeCommunicationGraph } from "./graph.ts"
import { toMermaid } from "./mermaid.ts"
import { defaultTopologyFilters, type TopologyFilters } from "./topology.ts"

export interface MermaidExportResult {
  outputPath: string
  status: "written" | "exists"
}

export async function exportMermaidGraph(
  inventory: AgentInventory,
  directory: string,
  filters?: TopologyFilters,
  overwrite = false,
): Promise<MermaidExportResult> {
  const outputPath = join(directory, "argchart.mmd")
  if (!overwrite && await fileExists(outputPath)) return { outputPath, status: "exists" }
  await writeFile(outputPath, toMermaid(analyzeCommunicationGraph(inventory), filters), "utf8")
  return { outputPath, status: "written" }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
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
