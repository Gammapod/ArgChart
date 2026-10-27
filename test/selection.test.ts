import assert from "node:assert/strict"
import test from "node:test"
import { analyzeCommunicationGraph } from "../src/graph.ts"
import { emptySelection, focusAgent, moveFocusedAgent, reconcileSelection } from "../src/tui/selection.ts"
import { node } from "./fixtures.ts"

const graph = () => analyzeCommunicationGraph({ view: "effective-runtime", refreshedAt: "2026-10-27T00:00:00.000Z", nodes: [node("a", "primary"), node("b", "subagent")] })

test("selection permits no focused agent", () => {
  assert.deepEqual(reconcileSelection(graph(), emptySelection), emptySelection)
})

test("selection movement and refresh reconciliation retain valid focus and clear removed focus", () => {
  assert.equal(moveFocusedAgent(graph(), emptySelection, 1).focusedAgentID, "a")
  assert.equal(moveFocusedAgent(graph(), focusAgent(emptySelection, "a"), -1).focusedAgentID, "b")
  assert.equal(reconcileSelection(analyzeCommunicationGraph({ view: "effective-runtime", refreshedAt: "2026-10-27T00:00:00.000Z", nodes: [node("b", "subagent")] }), focusAgent(emptySelection, "a")).focusedAgentID, undefined)
})
