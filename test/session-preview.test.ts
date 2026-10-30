import assert from "node:assert/strict"
import test from "node:test"
import { latestSessionPreviewTurn } from "../src/session-preview.ts"

test("session preview uses the newest prompt and latest following assistant text", () => {
  const turn = latestSessionPreviewTurn([
    { id: "old-user", type: "user", text: "Older", time: { created: 1 } },
    { id: "old-response", type: "assistant", agent: "build", model: { providerID: "test", id: "model" }, time: { created: 2 }, content: [{ type: "text", text: "Old response" }] },
    { id: "new-user", type: "user", text: "Newest", time: { created: 3 } },
    { id: "reasoning-only", type: "assistant", agent: "build", model: { providerID: "test", id: "model" }, time: { created: 4 }, content: [{ type: "reasoning", text: "Hidden" }] },
    { id: "new-response", type: "assistant", agent: "build", model: { providerID: "test", id: "model" }, time: { created: 5 }, content: [{ type: "text", text: "Visible" }, { type: "tool", id: "tool", name: "read", time: { created: 5 }, state: { status: "completed", input: {}, content: [{ type: "text", text: "Hidden tool output" }] } }] },
    { id: "later-tool-only", type: "assistant", agent: "build", model: { providerID: "test", id: "model" }, time: { created: 6 }, content: [{ type: "tool", id: "tool-later", name: "grep", time: { created: 6 }, state: { status: "completed", input: {}, content: [{ type: "text", text: "Also hidden" }] } }] },
  ])
  assert.deepEqual(turn, { prompt: "Newest", response: "Visible" })
})

test("session preview omits a response until an assistant text message exists", () => {
  assert.deepEqual(latestSessionPreviewTurn([{ id: "user", type: "user", text: "Hello", time: { created: 1 } }]), { prompt: "Hello" })
  assert.equal(latestSessionPreviewTurn([]), undefined)
})
