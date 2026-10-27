import assert from "node:assert/strict"
import test from "node:test"
import { analyzeCommunicationGraph } from "../src/graph.ts"
import type { AgentInventory } from "../src/domain.ts"
import { node } from "./fixtures.ts"

test("primary-only agents are excluded from callable graph targets and recorded as constraints", () => {
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
  assert.deepEqual(graph.constraints.map((constraint) => constraint.target), ["parent", "primary-only"])
})
