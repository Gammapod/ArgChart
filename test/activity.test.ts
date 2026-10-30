import assert from "node:assert/strict"
import test from "node:test"
import { ActivityService, delegatingAgentID, latestObservedChildSession, latestSessionForAgent, normalizeActivitySession, observeChildSessions, RECENT_SESSION_LIMIT } from "../src/activity.ts"

test("activity snapshot retains safe current and recent session fields", async () => {
  const service = new ActivityService({
    async list(input) {
      assert.deepEqual(input, { directory: "C:/project", limit: RECENT_SESSION_LIMIT, order: "desc", archived: false })
      return { data: [{
        id: "ses_child", parentID: "ses_parent", agent: "reviewer", title: "Review changes", outcome: "succeeded",
        time: { created: 10, updated: 20 },
      }] }
    },
  }, "C:/project")

  const snapshot = await service.snapshot()
  assert.equal(snapshot.view, "runtime-api")
  assert.deepEqual(snapshot.sessions, [{
    id: "ses_child", parentID: "ses_parent", agentID: "reviewer", title: "Review changes", outcome: "succeeded", createdAt: 10, updatedAt: 20,
  }])
  assert.deepEqual(snapshot.observedChildSessions, [])
})

test("observed child sessions require both parent and child agent identities", () => {
  const sessions = [
    { id: "ses_parent", agentID: "build", createdAt: 1, updatedAt: 2 },
    { id: "ses_child", parentID: "ses_parent", agentID: "reviewer", createdAt: 3, updatedAt: 4 },
    { id: "ses_missing_parent", parentID: "ses_absent", agentID: "explore", createdAt: 5, updatedAt: 6 },
  ]
  assert.deepEqual(observeChildSessions(sessions), [{
    parentSessionID: "ses_parent", childSessionID: "ses_child", sourceAgentID: "build", targetAgentID: "reviewer",
  }])
})

test("latest status sessions prefer active sessions then updated time", () => {
  const sessions = [
    { id: "ses_old", agentID: "build", createdAt: 1, updatedAt: 10, outcome: "succeeded" as const },
    { id: "ses_active", agentID: "build", createdAt: 2, updatedAt: 5 },
    { id: "ses_child", parentID: "ses_active", agentID: "reviewer", createdAt: 3, updatedAt: 20, outcome: "succeeded" as const },
  ]
  const observed = observeChildSessions(sessions)
  assert.equal(latestSessionForAgent(sessions, new Set(), "build")?.id, "ses_old")
  assert.equal(latestSessionForAgent(sessions, new Set(["ses_active"]), "build")?.id, "ses_active")
  assert.equal(latestObservedChildSession(sessions, new Set(), observed, "build", "reviewer")?.id, "ses_child")
})

test("delegating agent comes from the observed parent session", () => {
  const parent = { id: "ses_parent", agentID: "build", createdAt: 1, updatedAt: 2 }
  const child = { id: "ses_child", parentID: "ses_parent", agentID: "reviewer", createdAt: 3, updatedAt: 4 }
  assert.equal(delegatingAgentID(child, [parent, child]), "build")
  assert.equal(delegatingAgentID(parent, [parent, child]), undefined)
})

test("activity normalization omits unavailable session fields", () => {
  assert.deepEqual(normalizeActivitySession({ id: "ses_one", projectID: "project", cost: 0, tokens: {}, time: { created: 10, updated: 20 }, location: { directory: "C:/project" } }), {
    id: "ses_one", createdAt: 10, updatedAt: 20,
  })
})
