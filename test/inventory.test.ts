import assert from "node:assert/strict"
import test from "node:test"
import type { AgentInfo } from "@opencode/client"
import { normalizeAgent } from "../src/inventory.ts"

test("inventory normalization retains graph fields without exposing raw runtime payloads", () => {
  const normalized = normalizeAgent({
    id: "reviewer",
    name: "Reviewer",
    mode: "subagent",
    hidden: false,
    description: "Reviews changes",
    permissions: [{ action: "read", resource: "*", effect: "allow" }],
  } as AgentInfo)
  assert.deepEqual(normalized, {
    id: "reviewer",
    name: "Reviewer",
    mode: "subagent",
    hidden: false,
    description: "Reviews changes",
    permissions: [{ action: "read", resource: "*", effect: "allow" }],
  })
})
