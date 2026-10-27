import assert from "node:assert/strict"
import test from "node:test"
import { analyzeCommunicationGraph, evaluateSubagentPermission } from "../src/graph.ts"
import type { AgentInventory, GraphNode, PermissionRule } from "../src/domain.ts"

const node = (id: string, mode: GraphNode["mode"], permissions: readonly PermissionRule[] = []): GraphNode => ({
  id,
  name: id,
  mode,
  hidden: false,
  permissions,
  raw: {},
})

test("a targeted allow overrides a preceding broad deny", () => {
  const explanation = evaluateSubagentPermission(
    [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "reviewer", effect: "allow" },
    ],
    "reviewer",
  )

  assert.equal(explanation.decision, "allow")
  assert.deepEqual(explanation.matchingRule, {
    action: "subagent",
    resource: "reviewer",
    effect: "allow",
    index: 1,
  })
})

test("a targeted deny overrides a preceding broad allow", () => {
  const explanation = evaluateSubagentPermission(
    [
      { action: "subagent", resource: "*", effect: "allow" },
      { action: "subagent", resource: "reviewer", effect: "deny" },
    ],
    "reviewer",
  )

  assert.equal(explanation.decision, "deny")
  assert.equal(explanation.matchingRule?.index, 1)
})

test("primary-only agents are not callable graph targets", () => {
  const inventory: AgentInventory = {
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [
      node("parent", "primary", [{ action: "subagent", resource: "*", effect: "allow" }]),
      node("callable", "subagent"),
      node("primary-only", "primary"),
    ],
  }

  const graph = analyzeCommunicationGraph(inventory, "2026-10-27T00:00:00.000Z")

  assert.equal(graph.edges.some((edge) => edge.target === "primary-only"), false)
  assert.equal(graph.edges.find((edge) => edge.source === "parent" && edge.target === "callable")?.decision, "allow")
  assert.deepEqual(graph.constraints, [
    {
      type: "target-mode",
      target: "parent",
      summary: "parent is primary-only and cannot be called as a subagent.",
    },
    {
      type: "target-mode",
      target: "primary-only",
      summary: "primary-only is primary-only and cannot be called as a subagent.",
    },
  ])
})

test("a matching wildcard is identified and an unmatched permission defaults to ask", () => {
  const wildcard = evaluateSubagentPermission([{ action: "*", resource: "revie?er", effect: "allow" }], "reviewer")
  const unmatched = evaluateSubagentPermission([], "reviewer")

  assert.equal(wildcard.decision, "allow")
  assert.equal(unmatched.decision, "ask")
})
