import type {
  AgentInventory,
  CommunicationGraph,
  EdgeDecision,
  EdgeExplanation,
  GraphEdge,
  GraphConstraint,
  GraphNode,
  PermissionRule,
} from "./domain.js"
import { evaluatePermission } from "./permissions.ts"

export function analyzeCommunicationGraph(inventory: AgentInventory, generatedAt = new Date().toISOString()): CommunicationGraph {
  const targets = inventory.nodes.filter(isCallableSubagent)
  const edges = inventory.nodes.flatMap((source) => targets.map((target) => evaluateEdge(source, target)))

  return {
    view: "effective-runtime",
    generatedAt,
    nodes: inventory.nodes,
    edges,
    constraints: inventory.nodes.filter((node) => node.mode === "primary").map(targetModeConstraint),
  }
}

function targetModeConstraint(node: GraphNode): GraphConstraint {
  return {
    type: "target-mode",
    target: node.id,
    summary: `${node.id} is primary-only and cannot be called as a subagent.`,
  }
}

export function evaluateSubagentPermission(rules: readonly PermissionRule[], targetID: string): EdgeExplanation {
  const decision = evaluatePermission(rules, { action: "subagent", resource: targetID })
  return {
    decision: decision.decision,
    ...(decision.matchingRule === undefined ? {} : { matchingRule: decision.matchingRule }),
    summary: decision.summary,
  }
}

function evaluateEdge(source: GraphNode, target: GraphNode): GraphEdge {
  const explanation = evaluateSubagentPermission(source.permissions, target.id)

  return {
    source: source.id,
    target: target.id,
    decision: explanation.decision,
    wildcardDerived: explanation.matchingRule ? hasWildcard(explanation.matchingRule.resource) : false,
    explanation,
    constraints: [],
  }
}

function isCallableSubagent(node: GraphNode): boolean {
  return node.mode === "subagent" || node.mode === "all"
}

function hasWildcard(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("?")
}
