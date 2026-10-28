import assert from "node:assert/strict"
import test from "node:test"
import { evaluateSubagentPermission } from "../src/graph.ts"
import { evaluatePermission } from "../src/permissions.ts"

test("a targeted allow overrides a preceding broad deny", () => {
  const explanation = evaluateSubagentPermission([
    { action: "subagent", resource: "*", effect: "deny" },
    { action: "subagent", resource: "reviewer", effect: "allow" },
  ], "reviewer")
  assert.equal(explanation.decision, "allow")
  assert.equal(explanation.matchingRule?.index, 1)
})

test("a targeted deny overrides a preceding broad allow", () => {
  const explanation = evaluateSubagentPermission([
    { action: "subagent", resource: "*", effect: "allow" },
    { action: "subagent", resource: "reviewer", effect: "deny" },
  ], "reviewer")
  assert.equal(explanation.decision, "deny")
  assert.equal(explanation.matchingRule?.index, 1)
})

test("wildcards match whole values and unmatched permissions default to ask", () => {
  assert.equal(evaluateSubagentPermission([{ action: "*", resource: "revie?er", effect: "allow" }], "reviewer").decision, "allow")
  assert.equal(evaluateSubagentPermission([], "reviewer").decision, "ask")
})

test("generic evaluator explains every matching rule in order", () => {
  const decision = evaluatePermission([
    { action: "edit", resource: "*", effect: "deny" },
    { action: "edit", resource: "src/*", effect: "allow" },
    { action: "edit", resource: "src/*.mcp", effect: "deny" },
  ], { action: "edit", resource: "./src/server.mcp" })
  assert.equal(decision.resource, "src/server.mcp")
  assert.equal(decision.decision, "deny")
  assert.deepEqual(decision.matchingRules.map((rule) => rule.index), [0, 1, 2])
})

test("path actions reject paths outside the workspace while non-path actions stay opaque", () => {
  assert.throws(() => evaluatePermission([], { action: "read", resource: "../secret" }))
  assert.equal(evaluatePermission([], { action: "shell", resource: "git status --short" }).resource, "git status --short")
})
