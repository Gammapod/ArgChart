import assert from "node:assert/strict"
import test from "node:test"
import { analyzeCommunicationGraph } from "../src/graph.ts"
import { USER_NODE_ID, buildCommunicationTopology, defaultTopologyFilters, filterTopology, layoutLocalTopology, listLocalRelationships } from "../src/topology.ts"
import { node } from "./fixtures.ts"

test("topology adds User selection and question edges", () => {
  const graph = analyzeCommunicationGraph({
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [
      node("primary", "primary", [{ action: "question", resource: "*", effect: "allow" }]),
      node("all", "all", [{ action: "question", resource: "*", effect: "ask" }]),
      node("subagent", "subagent", [{ action: "question", resource: "*", effect: "deny" }]),
    ],
  })
  const topology = buildCommunicationTopology(graph)
  assert.deepEqual(topology.edges.filter((edge) => edge.kind === "user-selection").map((edge) => edge.target), ["primary", "all"])
  assert.equal(topology.edges.some((edge) => edge.source === USER_NODE_ID && edge.target === "subagent"), false)
  assert.deepEqual(
    topology.edges.filter((edge) => edge.kind === "user-question").map((edge) => [edge.source, edge.decision]),
    [["primary", "allow"], ["all", "ask"], ["subagent", "deny"]],
  )
})

test("default topology filters hide subagents and deny edges", () => {
  const graph = analyzeCommunicationGraph({ view: "effective-runtime", refreshedAt: "2026-10-27T00:00:00.000Z", nodes: [node("primary", "primary"), node("subagent", "subagent")] })
  const filtered = filterTopology(buildCommunicationTopology(graph), defaultTopologyFilters)
  assert.deepEqual(filtered.nodes.map((entry) => entry.id), [USER_NODE_ID, "primary"])
  assert.equal(filtered.edges.some((edge) => edge.decision === "deny"), false)
})

test("localized layout assigns every neighbor once and keeps two-way agents on the outbound side", () => {
  const graph = analyzeCommunicationGraph({
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [
      node("selected", "all", [
        { action: "subagent", resource: "inbound", effect: "deny" },
        { action: "subagent", resource: "outbound", effect: "allow" },
        { action: "subagent", resource: "two-way", effect: "ask" },
      ]),
      node("inbound", "all", [{ action: "subagent", resource: "selected", effect: "allow" }]),
      node("outbound", "subagent"),
      node("two-way", "all", [{ action: "subagent", resource: "selected", effect: "allow" }]),
    ],
  })
  const topology = filterTopology(buildCommunicationTopology(graph), { showSubagents: true, showAskEdges: true, showDenyEdges: false })
  const layout = layoutLocalTopology(topology, "selected")
  assert.deepEqual(layout.inbound.map((neighbor) => neighbor.node.id), ["inbound"])
  assert.deepEqual(layout.outbound.map((neighbor) => neighbor.node.id), [USER_NODE_ID, "outbound", "two-way"])
  assert.equal(layout.outbound.find((neighbor) => neighbor.node.id === "two-way")?.inbound?.decision, "allow")
  assert.equal(layout.outbound.find((neighbor) => neighbor.node.id === "two-way")?.outbound?.decision, "ask")
  const relationships = listLocalRelationships(topology, "selected")
  assert.deepEqual(relationships.map((neighbor) => neighbor.node.id), [USER_NODE_ID, "inbound", "outbound", "two-way"])
  assert.equal(relationships.find((neighbor) => neighbor.node.id === "two-way")?.inbound?.decision, "allow")
  assert.equal(relationships.find((neighbor) => neighbor.node.id === "two-way")?.outbound?.decision, "ask")
})
