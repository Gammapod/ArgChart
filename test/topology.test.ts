import assert from "node:assert/strict"
import test from "node:test"
import { analyzeCommunicationGraph } from "../src/graph.ts"
import { USER_NODE_ID, buildCommunicationTopology, defaultTopologyFilters, filterTopology, layoutLocalTopology } from "../src/topology.ts"
import { node } from "./fixtures.ts"

test("topology adds User edges for primary and all agents but not subagent-only agents", () => {
  const graph = analyzeCommunicationGraph({ view: "effective-runtime", refreshedAt: "2026-10-27T00:00:00.000Z", nodes: [node("primary", "primary"), node("all", "all"), node("subagent", "subagent")] })
  const topology = buildCommunicationTopology(graph)
  assert.deepEqual(topology.edges.filter((edge) => edge.kind === "user-selection").map((edge) => edge.target), ["primary", "all"])
  assert.equal(topology.edges.some((edge) => edge.source === USER_NODE_ID && edge.target === "subagent"), false)
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
  assert.deepEqual(layout.inbound.map((neighbor) => neighbor.node.id), [USER_NODE_ID, "inbound"])
  assert.deepEqual(layout.outbound.map((neighbor) => neighbor.node.id), ["outbound", "two-way"])
  assert.equal(layout.outbound.find((neighbor) => neighbor.node.id === "two-way")?.inbound?.decision, "allow")
  assert.equal(layout.outbound.find((neighbor) => neighbor.node.id === "two-way")?.outbound?.decision, "ask")
})
