import { Plugin } from "@opencode/plugin"
import { ActivityService } from "./activity.js"
import { analyzeCommunicationGraph } from "./graph.js"
import { exportMermaidGraph, normalizeTopologyFilters } from "./export.js"
import { AgentInventoryService } from "./inventory.js"
import { FileScopeService } from "./file-scope.ts"
import { evaluatePermission } from "./permissions.ts"
import { ArgChartRPC } from "./rpc.js"

export default Plugin.define({
  id: "argchart",
  async setup(ctx) {
    const inventory = new AgentInventoryService(ctx.agent)
    const activity = new ActivityService(ctx.session, ctx.location.directory)
    const fileScope = new FileScopeService(ctx.location.directory)

    await ctx.rpc.register(ArgChartRPC, {
      "inventory.refresh": () => inventory.refresh(),
      "graph.refresh": async () => {
        fileScope.clearCache()
        return analyzeCommunicationGraph(await inventory.refresh())
      },
      "activity.refresh": () => activity.snapshot(),
      "permission.evaluate": async (input) => {
        const request = input as { agentID: string; action: string; resource: string }
        const agent = (await inventory.refresh()).nodes.find((node) => node.id === request.agentID)
        if (!agent) throw new Error(`Unknown agent ${request.agentID}.`)
        return evaluatePermission(agent.permissions, request)
      },
      "file-scope.list": async (input) => {
        const request = input as { agentID: string; path: string }
        const agent = (await inventory.refresh()).nodes.find((node) => node.id === request.agentID)
        if (!agent) throw new Error(`Unknown agent ${request.agentID}.`)
        return fileScope.list(agent, request.path)
      },
      "graph.export-mermaid": async (input) => exportMermaidGraph(
        await inventory.refresh(),
        ctx.location.directory,
        normalizeTopologyFilters(input),
        Boolean((input as { overwrite?: unknown }).overwrite),
      ),
    })
  },
})

export type {
  AgentID,
  ActivitySession,
  ActivitySnapshot,
  ObservedChildSession,
  AgentInventory,
  AgentMode,
  AgentModel,
  EdgeDecision,
  EdgeExplanation,
  GraphConstraint,
  GraphEdge,
  GraphNode,
  CommunicationGraph,
  MatchedPermissionRule,
  PermissionRule,
  PermissionDecision,
  PermissionRequest,
  FileScopeEntry,
  FileScopeDirectory,
} from "./domain.js"
export { ArgChartRPC } from "./rpc.js"
