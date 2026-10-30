import type { SessionInfo } from "@opencode/client"
import type { ActivitySession, ActivitySnapshot, ObservedChildSession } from "./domain.ts"

export const RECENT_SESSION_LIMIT = 100

export interface SessionRegistry {
  list(input: { directory: string; limit: number; order: "desc"; archived: boolean }): Promise<{ data: readonly SessionInfo[] }>
}

/** Read-only session inventory. Live execution state remains client-owned. */
export class ActivityService {
  private readonly sessions: SessionRegistry
  private readonly directory: string

  constructor(sessions: SessionRegistry, directory: string) {
    this.sessions = sessions
    this.directory = directory
  }

  async snapshot(): Promise<ActivitySnapshot> {
    const result = await this.sessions.list({ directory: this.directory, limit: RECENT_SESSION_LIMIT, order: "desc", archived: false })
    const sessions = result.data.map(normalizeActivitySession)
    return {
      view: "runtime-api",
      generatedAt: new Date().toISOString(),
      sessions,
      observedChildSessions: observeChildSessions(sessions),
    }
  }
}

export function normalizeActivitySession(session: SessionInfo): ActivitySession {
  return {
    id: session.id,
    createdAt: session.time.created,
    updatedAt: session.time.updated,
    ...(session.parentID === undefined ? {} : { parentID: session.parentID }),
    ...(session.agent === undefined ? {} : { agentID: session.agent }),
    ...(session.title === undefined ? {} : { title: session.title }),
    ...(session.outcome === undefined ? {} : { outcome: session.outcome }),
  }
}

/**
 * Session hierarchy is observed runtime data, not proof that a particular
 * configured subagent permission caused the child session.
 */
export function observeChildSessions(sessions: readonly ActivitySession[]): readonly ObservedChildSession[] {
  const byID = new Map(sessions.map((session) => [session.id, session]))
  return sessions.flatMap((child) => {
    if (!child.parentID || !child.agentID) return []
    const parent = byID.get(child.parentID)
    if (!parent?.agentID) return []
    return [{
      parentSessionID: parent.id,
      childSessionID: child.id,
      sourceAgentID: parent.agentID,
      targetAgentID: child.agentID,
    }]
  })
}

/** Selects an agent's current session first, otherwise its most recently updated session. */
export function latestSessionForAgent(
  sessions: readonly ActivitySession[],
  activeSessionIDs: ReadonlySet<string>,
  agentID: string,
): ActivitySession | undefined {
  const matching = sessions.filter((session) => session.agentID === agentID)
  return [...matching].sort((left, right) => {
    const activeOrder = Number(activeSessionIDs.has(right.id)) - Number(activeSessionIDs.has(left.id))
    return activeOrder || right.updatedAt - left.updatedAt
  })[0]
}

/** Returns the parent session's recorded agent for a child session, when available. */
export function delegatingAgentID(session: ActivitySession, sessions: readonly ActivitySession[]): string | undefined {
  if (!session.parentID) return undefined
  return sessions.find((candidate) => candidate.id === session.parentID)?.agentID
}

/** Selects the newest observed child session for a directed parent-agent relationship. */
export function latestObservedChildSession(
  sessions: readonly ActivitySession[],
  activeSessionIDs: ReadonlySet<string>,
  childSessions: readonly ObservedChildSession[],
  sourceAgentID: string,
  targetAgentID: string,
): ActivitySession | undefined {
  const IDs = new Set(childSessions
    .filter((session) => session.sourceAgentID === sourceAgentID && session.targetAgentID === targetAgentID)
    .map((session) => session.childSessionID))
  return sessions
    .filter((session) => IDs.has(session.id))
    .sort((left, right) => {
      const activeOrder = Number(activeSessionIDs.has(right.id)) - Number(activeSessionIDs.has(left.id))
      return activeOrder || right.updatedAt - left.updatedAt
    })[0]
}
