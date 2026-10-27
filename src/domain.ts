export type AgentID = string

export type EdgeDecision = "allow" | "ask" | "deny"

export interface GraphNode {
  id: AgentID
  description?: string
  mode: "primary" | "subagent" | "all"
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
