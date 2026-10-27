import { Plugin } from "@opencode/plugin"
import { analyzeCommunicationGraph } from "./graph.js"
import { exportMermaidGraph, normalizeTopologyFilters } from "./export.js"
import { AgentInventoryService } from "./inventory.js"
import { ArgChartRPC } from "./rpc.js"

export default Plugin.define({
  id: "argchart",
  async setup(ctx) {
    const inventory = new AgentInventoryService(ctx.agent)

    await ctx.rpc.register(ArgChartRPC, {
      "inventory.refresh": () => inventory.refresh(),
      "graph.refresh": async () => analyzeCommunicationGraph(await inventory.refresh()),
      "graph.export-mermaid": async (filters) => exportMermaidGraph(await inventory.refresh(), ctx.location.directory, normalizeTopologyFilters(filters)),
    })
  },
})

export type {
  AgentID,
  AgentInventory,
  AgentMode,
  AgentModel,
  AgentRuntimeData,
  EdgeDecision,
  EdgeExplanation,
  GraphConstraint,
  GraphEdge,
  GraphNode,
  CommunicationGraph,
  MatchedPermissionRule,
  PermissionRule,
} from "./domain.js"
export { ArgChartRPC } from "./rpc.js"
