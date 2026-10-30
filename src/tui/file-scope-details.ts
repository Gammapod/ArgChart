import type { PermissionDecision } from "../domain.js"

const permissiveness: Record<PermissionDecision["decision"], number> = { deny: 0, ask: 1, allow: 2 }

export function formatMatchingRule(decision: PermissionDecision): string {
  const rule = decision.matchingRule
  return rule
    ? `Rule ${rule.index + 1}: ${rule.action}:${rule.resource} → ${rule.effect}`
    : "No matching rule: defaults to ask"
}

export function editIsMorePermissive(read: PermissionDecision, edit: PermissionDecision): boolean {
  return permissiveness[edit.decision] > permissiveness[read.decision]
}
