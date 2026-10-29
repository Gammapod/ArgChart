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

export interface PermissionRequest {
  action: string
  resource: string
}

/** A prospective decision over the runtime-resolved ordered rule set. */
export interface PermissionDecision {
  action: string
  resource: string
  decision: EdgeDecision
  matchingRule?: MatchedPermissionRule
  matchingRules: readonly MatchedPermissionRule[]
  summary: string
}

export type FileScopeEntryKind = "file" | "directory" | "pattern"

export interface FileScopeEntry {
  path: string
  name: string
  depth: number
  kind: FileScopeEntryKind
  exists: boolean
  read: PermissionDecision
  edit: PermissionDecision
  /** A nested path has a different effective read decision. */
  readHasNestedException: boolean
  /** A nested path has a different effective edit decision. */
  editHasNestedException: boolean
}

export interface FileScopeDirectory {
  view: "effective-runtime"
  agentID: AgentID
  path: string
  /** Direct children only; request a directory path to load its children. */
  entries: readonly FileScopeEntry[]
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
