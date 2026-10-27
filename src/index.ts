import { Plugin } from "@opencode/plugin"
import { AgentInventoryService } from "./inventory.js"
import { ArgChartRPC } from "./rpc.js"

export default Plugin.define({
  id: "argchart",
  async setup(ctx) {
    const inventory = new AgentInventoryService(ctx.agent)

    await ctx.rpc.register(ArgChartRPC, {
      "inventory.refresh": () => inventory.refresh(),
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
  GraphEdge,
  GraphNode,
} from "./domain.js"
export { ArgChartRPC } from "./rpc.js"
