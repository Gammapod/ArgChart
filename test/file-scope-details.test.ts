import assert from "node:assert/strict"
import test from "node:test"
import type { PermissionDecision } from "../src/domain.ts"
import { editIsMorePermissive, formatMatchingRule } from "../src/tui/file-scope-details.ts"

const decision = (value: PermissionDecision["decision"], matchingRule?: PermissionDecision["matchingRule"]): PermissionDecision => ({
  action: "read",
  resource: "src/example.ts",
  decision: value,
  matchingRules: matchingRule ? [matchingRule] : [],
  matchingRule,
  summary: value,
})

test("file-scope details format the final matching rule or default", () => {
  assert.equal(formatMatchingRule(decision("ask")), "No matching rule: defaults to ask")
  assert.equal(
    formatMatchingRule(decision("allow", { action: "read", resource: "src/*", effect: "allow", index: 3 })),
    "Rule 4: read:src/* → allow",
  )
})

test("file-scope details identify edit decisions more permissive than read", () => {
  assert.equal(editIsMorePermissive(decision("deny"), decision("ask")), true)
  assert.equal(editIsMorePermissive(decision("ask"), decision("allow")), true)
  assert.equal(editIsMorePermissive(decision("allow"), decision("deny")), false)
  assert.equal(editIsMorePermissive(decision("ask"), decision("ask")), false)
})
