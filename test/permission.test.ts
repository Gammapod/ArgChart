import assert from "node:assert/strict"
import test from "node:test"
import { evaluateSubagentPermission } from "../src/graph.ts"

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
