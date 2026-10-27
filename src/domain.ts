export type AgentID = string

export type EdgeDecision = "allow" | "ask" | "deny"

export type AgentMode = "primary" | "subagent" | "all"

export interface AgentModel {
  providerID: string
  id: string
  variant?: string
}

export type AgentRuntimeData = Readonly<Record<string, unknown>>

export interface GraphNode {
  id: AgentID
  name: string
  description?: string
  mode: AgentMode
  model?: AgentModel
  hidden: boolean
  raw: AgentRuntimeData
}

export interface GraphEdge {
  source: AgentID
  target: AgentID
  decision: EdgeDecision
}

export interface EdgeExplanation {
  decision: EdgeDecision
  summary: string
}

export interface AgentInventory {
  view: "effective-runtime"
  refreshedAt: string
  nodes: readonly GraphNode[]
}
