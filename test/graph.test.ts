import assert from "node:assert/strict"
import test from "node:test"
import { analyzeCommunicationGraph, evaluateSubagentPermission } from "../src/graph.ts"
import { USER_NODE_ID, buildCommunicationTopology, defaultTopologyFilters, filterTopology, layoutLocalTopology, visibleTopologyEdges } from "../src/topology.ts"
import { toMermaid } from "../src/mermaid.ts"
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

test("topology adds User edges for primary and all agents but keeps subagents agent-only", () => {
  const graph = analyzeCommunicationGraph({
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [node("primary", "primary"), node("all", "all"), node("subagent", "subagent")],
  })
  const topology = buildCommunicationTopology(graph)

  assert.deepEqual(
    topology.edges.filter((edge) => edge.kind === "user-selection"),
    [
      { source: USER_NODE_ID, target: "primary", decision: "allow", kind: "user-selection" },
      { source: USER_NODE_ID, target: "all", decision: "allow", kind: "user-selection" },
    ],
  )
  assert.equal(topology.edges.some((edge) => edge.source === USER_NODE_ID && edge.target === "subagent"), false)
})

test("localized topology retains allow and ask edges while hiding denied edges", () => {
  const graph = analyzeCommunicationGraph({
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [
      node("parent", "primary", [
        { action: "subagent", resource: "allowed", effect: "allow" },
        { action: "subagent", resource: "denied", effect: "deny" },
      ]),
      node("allowed", "subagent"),
      node("asked", "subagent"),
      node("denied", "subagent"),
    ],
  })

  const visible = visibleTopologyEdges(buildCommunicationTopology(graph), "parent")

  assert.deepEqual(visible.map((edge) => `${edge.source}:${edge.target}:${edge.decision}`), [
    "argchart:user:parent:allow",
    "parent:allowed:allow",
    "parent:asked:ask",
  ])
})

test("topology filters hide subagents and denied edges by default while retaining ask edges", () => {
  const graph = analyzeCommunicationGraph({
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [node("primary", "primary"), node("subagent", "subagent")],
  })
  const filtered = filterTopology(buildCommunicationTopology(graph), defaultTopologyFilters)

  assert.deepEqual(filtered.nodes.map((node) => node.id), [USER_NODE_ID, "primary"])
  assert.equal(filtered.edges.some((edge) => edge.decision === "deny"), false)
  assert.equal(filtered.edges.some((edge) => edge.decision === "ask"), false)
})

test("localized layout assigns every neighbor once and keeps two-way agents in the outbound column", () => {
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
  const layout = layoutLocalTopology(filterTopology(buildCommunicationTopology(graph), { showSubagents: true, showAskEdges: true, showDenyEdges: false }), "selected")

  assert.deepEqual(layout.inbound.map((neighbor) => neighbor.node.id), [USER_NODE_ID, "inbound"])
  assert.deepEqual(layout.outbound.map((neighbor) => neighbor.node.id), ["outbound", "two-way"])
  assert.equal(layout.outbound.find((neighbor) => neighbor.node.id === "two-way")?.inbound?.decision, "allow")
  assert.equal(layout.outbound.find((neighbor) => neighbor.node.id === "two-way")?.outbound?.decision, "ask")
})

test("Mermaid export includes the User node and preserves edge decisions", () => {
  const graph = analyzeCommunicationGraph({
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [
      node("primary", "primary", [{ action: "subagent", resource: "child", effect: "ask" }]),
      node("child", "subagent"),
    ],
  }, "2026-10-27T00:00:00.000Z")
  const output = toMermaid(graph, { showSubagents: true, showAskEdges: true, showDenyEdges: true })

  assert.match(output, /\["User"\]/)
  assert.match(output, /\|allow\|/)
  assert.match(output, /\|ask\|/)
})
