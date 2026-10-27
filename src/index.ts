import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "argchart",
  setup() {},
})

export type { AgentID, EdgeDecision, EdgeExplanation, GraphEdge, GraphNode } from "./domain.js"
