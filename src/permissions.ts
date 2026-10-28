import type { MatchedPermissionRule, PermissionDecision, PermissionRequest, PermissionRule } from "./domain.ts"

/**
 * Evaluates effective rules without invoking the session-bound OpenCode
 * permission engine.  Resources are normalized only for path actions; other
 * action resource languages remain opaque strings.
 */
export function evaluatePermission(rules: readonly PermissionRule[], request: PermissionRequest): PermissionDecision {
  const action = request.action
  const resource = normalizeResource(action, request.resource)
  const matchingRules: MatchedPermissionRule[] = []

  rules.forEach((rule, index) => {
    if (matches(rule.action, action) && matches(rule.resource, resource)) matchingRules.push({ ...rule, index })
  })

  const matchingRule = matchingRules.at(-1)
  if (!matchingRule) {
    return {
      action,
      resource,
      decision: "ask",
      matchingRules,
      summary: `No ${action} permission rule matches ${resource}; OpenCode defaults to ask.`,
    }
  }

  return {
    action,
    resource,
    decision: matchingRule.effect,
    matchingRule,
    matchingRules,
    summary: `Rule ${matchingRule.index + 1} is the last matching ${action} rule: ${matchingRule.action}:${matchingRule.resource} → ${matchingRule.effect}.`,
  }
}

export function normalizeResource(action: string, resource: string): string {
  if (action !== "read" && action !== "edit") return resource
  const normalized = resource.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/")
  if (!normalized || normalized === "." || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Expected a workspace-relative ${action} path, received ${resource}.`)
  }
  return normalized
}

export function matches(pattern: string, value: string): boolean {
  const flags = process.platform === "win32" ? "i" : ""
  const expression = [...pattern]
    .map((character) => character === "*" ? ".*" : character === "?" ? "." : escapeRegExp(character))
    .join("")
  return new RegExp(`^${expression}$`, flags).test(value)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
