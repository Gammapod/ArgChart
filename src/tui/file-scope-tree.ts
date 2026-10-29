import type { FileScopeDirectory, FileScopeEntry } from "../domain.js"

/** A visible row assembled from independently lazy-loaded directories. */
export interface FileScopeTreeEntry {
  entry: FileScopeEntry
  depth: number
  expanded: boolean
  loading: boolean
}

/**
 * Produces the visible agent-perspective tree from loaded directory responses.
 * Denied directories stay visible as structural boundaries for more-specific
 * exceptions; fully denied files remain hidden.
 */
export function buildFileScopeTree(
  scopes: Readonly<Record<string, FileScopeDirectory>>,
  expandedPaths: ReadonlySet<string>,
  loadingPaths: ReadonlySet<string>,
): readonly FileScopeTreeEntry[] {
  const visit = (path: string, depth: number): FileScopeTreeEntry[] => {
    const scope = scopes[path]
    if (!scope) return []
    return scope.entries
      .filter((entry) => entry.kind === "directory" || entry.read.decision !== "deny" || entry.edit.decision !== "deny")
      .flatMap((entry) => {
        const expanded = entry.kind === "directory" && expandedPaths.has(entry.path)
        const row: FileScopeTreeEntry = { entry, depth, expanded, loading: loadingPaths.has(entry.path) }
        return expanded ? [row, ...visit(entry.path, depth + 1)] : [row]
      })
  }
  return visit("", 0)
}

export function clampFileScopeSelection(index: number, entries: readonly FileScopeTreeEntry[]): number {
  return Math.min(index, Math.max(0, entries.length - 1))
}
