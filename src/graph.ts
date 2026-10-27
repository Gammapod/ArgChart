import type {
  AgentInventory,
  CommunicationGraph,
  EdgeDecision,
  EdgeExplanation,
  GraphEdge,
  GraphConstraint,
  GraphNode,
  MatchedPermissionRule,
  PermissionRule,
} from "./domain.js"

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
  let matchingRule: MatchedPermissionRule | undefined

  rules.forEach((rule, index) => {
    if (matches(rule.action, "subagent") && matches(rule.resource, targetID)) {
      matchingRule = { ...rule, index }
    }
  })

  if (!matchingRule) {
    return {
      decision: "ask",
      summary: `No subagent permission rule matches ${targetID}; OpenCode defaults to ask.`,
    }
  }

  return {
    decision: matchingRule.effect,
    matchingRule,
    summary: `Rule ${matchingRule.index + 1} is the last matching subagent rule: ${matchingRule.action}:${matchingRule.resource} → ${matchingRule.effect}.`,
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

function matches(pattern: string, value: string): boolean {
  const flags = process.platform === "win32" ? "i" : ""
  const expression = [...pattern]
    .map((character) => {
      if (character === "*") return ".*"
      if (character === "?") return "."
      return escapeRegExp(character)
    })
    .join("")

  return new RegExp(`^${expression}$`, flags).test(value)
}

function hasWildcard(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("?")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
