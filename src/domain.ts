export type AgentID = string

export type EdgeDecision = "allow" | "ask" | "deny"

export type AgentMode = "primary" | "subagent" | "all"

export interface PermissionRule {
  action: string
  resource: string
  effect: EdgeDecision
}

export interface AgentModel {
  providerID: string
  id: string
  variant?: string
}

export interface GraphNode {
  id: AgentID
  name: string
  description?: string
  mode: AgentMode
  model?: AgentModel
  hidden: boolean
  permissions: readonly PermissionRule[]
}

export interface GraphEdge {
  source: AgentID
  target: AgentID
  decision: EdgeDecision
  wildcardDerived: boolean
  explanation: EdgeExplanation
  constraints: readonly GraphConstraint[]
}

export interface EdgeExplanation {
  decision: EdgeDecision
  summary: string
  matchingRule?: MatchedPermissionRule
}

export interface MatchedPermissionRule extends PermissionRule {
  index: number
}

export interface GraphConstraint {
  type: "target-mode" | "runtime-depth"
  summary: string
  target?: AgentID
}

export interface AgentInventory {
  view: "effective-runtime"
  refreshedAt: string
  nodes: readonly GraphNode[]
}

export interface CommunicationGraph {
  view: "effective-runtime"
  generatedAt: string
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
  constraints: readonly GraphConstraint[]
}
