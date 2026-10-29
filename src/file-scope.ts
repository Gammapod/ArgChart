import { readdir } from "node:fs/promises"
import { resolve, sep } from "node:path"
import type { FileScopeDirectory, FileScopeEntry, GraphNode, PermissionRule } from "./domain.ts"
import { evaluatePermission, normalizeResource } from "./permissions.ts"

interface ScopeNode {
  name: string
  path: string
  kind: "file" | "directory"
  exists: boolean
  children: Map<string, ScopeNode>
}

/** Read-only, directory-lazy projection of one workspace directory for one agent. */
export class FileScopeService {
  private readonly workspace: string
  private readonly directoryCache = new Map<string, Promise<FileScopeDirectory>>()

  constructor(workspace: string) {
    this.workspace = workspace
  }

  async list(agent: GraphNode, requestedPath = ""): Promise<FileScopeDirectory> {
    const path = normalizeDirectoryPath(requestedPath)
    const cacheKey = `${agent.id}\0${path}\0${JSON.stringify(agent.permissions)}`
    let result = this.directoryCache.get(cacheKey)
    if (!result) {
      result = this.readDirectory(agent, path)
      this.directoryCache.set(cacheKey, result)
      void result.catch(() => {
        // Do not make a transient filesystem error permanent for this agent
        // and directory; a later expansion can retry it.
        if (this.directoryCache.get(cacheKey) === result) this.directoryCache.delete(cacheKey)
      })
    }
    return result
  }

  clearCache(): void {
    this.directoryCache.clear()
  }

  private async readDirectory(agent: GraphNode, path: string): Promise<FileScopeDirectory> {
    const directory = resolve(this.workspace, path)
    assertInWorkspace(this.workspace, directory)
    // The synthetic root represents the requested directory so its baseline
    // decision and each child's full resource path remain correct.
    const root = createNode("", path, "directory", true)
    await this.readDirectoryEntries(directory, path, root)
    addVirtualRuleChildren(root, agent.permissions, path)
    const entries = projectTree(root, agent)
    return { view: "effective-runtime", agentID: agent.id, path, entries }
  }

  private async readDirectoryEntries(directory: string, relativePath: string, parent: ScopeNode): Promise<void> {
    const diskEntries = await readdir(directory, { withFileTypes: true })
    for (const entry of diskEntries) {
      if (entry.isSymbolicLink() || isIgnoredDirectory(entry.name, entry.isDirectory())) continue
      const path = joinPath(relativePath, entry.name)
      ensureNode(parent, [entry.name], entry.isDirectory() ? "directory" : "file", true)
    }
  }
}

function addVirtualRuleChildren(root: ScopeNode, rules: readonly PermissionRule[], directoryPath: string): void {
  const directorySegments = directoryPath ? directoryPath.split("/") : []
  for (const rule of rules) {
    if (rule.action !== "read" && rule.action !== "edit") continue
    let resource: string
    try { resource = normalizeResource(rule.action, rule.resource) } catch { continue }
    const segments = resource.split("/")
    const wildcardAt = segments.findIndex((segment) => /[*?]/.test(segment))
    // A glob has no concrete leaf. Materialize its literal directory prefix,
    // if any, so a rule such as assets/* can be represented truthfully.
    const literalPath = wildcardAt < 0 ? segments : segments.slice(0, wildcardAt)
    if (literalPath.length < directorySegments.length || !directorySegments.every((segment, index) => literalPath[index] === segment)) continue
    const remainingPath = literalPath.slice(directorySegments.length)
    if (!remainingPath.length) continue
    // Only materialize an immediate child. Descendants are loaded if and when
    // the viewer opens the corresponding directory.
    ensureNode(root, [remainingPath[0]], remainingPath.length > 1 || wildcardAt >= 0 ? "directory" : "file", false)
  }
}

function projectTree(root: ScopeNode, agent: GraphNode): FileScopeEntry[] {
  const rootState = scopeState(root, agent)
  return projectChildren(root, rootState, agent)
}

function projectChildren(parent: ScopeNode, parentState: ScopeState, agent: GraphNode): FileScopeEntry[] {
  const output: FileScopeEntry[] = []
  for (const node of sortedChildren(parent)) {
    const state = scopeState(node, agent)
    const children = node.kind === "directory" ? projectChildren(node, state, agent) : []
    // Directories establish useful project structure. Actual files are only
    // shown when they differ from their containing scope; virtual literals are
    // always shown because the rule explicitly names them.
    const show = node.kind === "directory" || !node.exists || !sameState(state, parentState)
    if (!show) continue
    output.push({
      path: node.path,
      name: node.name,
      kind: node.kind,
      exists: node.exists,
      ...state,
      readHasNestedException: hasNestedException(node, agent, "read", state.read.decision),
      editHasNestedException: hasNestedException(node, agent, "edit", state.edit.decision),
    })
    output.push(...children)
  }
  return output
}

interface ScopeState {
  read: ReturnType<typeof evaluatePermission>
  edit: ReturnType<typeof evaluatePermission>
}

function scopeState(node: ScopeNode, agent: GraphNode): ScopeState {
  // A directory row describes the scope below it, not an operation on the
  // directory itself. The representative child makes `secrets/*` apply to
  // `secrets/`, and works for virtual literal-prefix directories too.
  const resource = node.kind === "directory" ? joinPath(node.path, ".argchart-scope") : node.path
  return {
    read: evaluatePermission(agent.permissions, { action: "read", resource }),
    edit: evaluatePermission(agent.permissions, { action: "edit", resource }),
  }
}

function sameState(left: ScopeState, right: ScopeState): boolean {
  return left.read.decision === right.read.decision && left.edit.decision === right.edit.decision
}

function hasNestedException(node: ScopeNode, agent: GraphNode, action: "read" | "edit", decision: ScopeState["read"]["decision"]): boolean {
  if (node.kind !== "directory") return false
  const prefix = node.path ? `${node.path}/` : ""
  return agent.permissions.some((rule) => {
    if (rule.action !== action) return false
    let resource: string
    try { resource = normalizeResource(action, rule.resource) } catch { return false }
    // A rule whose literal start is outside this directory cannot prove an
    // exception below it. Replacing wildcards produces a representative path
    // that is then evaluated through the complete, ordered effective rules.
    if (!resource.startsWith(prefix)) return false
    const witness = resource.replace(/\*/g, ".argchart-exception").replace(/\?/g, "x")
    if (!witness.startsWith(prefix) || witness === node.path) return false
    return evaluatePermission(agent.permissions, { action, resource: witness }).decision !== decision
  })
}

function sortedChildren(node: ScopeNode): ScopeNode[] {
  return [...node.children.values()].sort((left, right) =>
    Number(right.kind === "directory") - Number(left.kind === "directory") || left.name.localeCompare(right.name),
  )
}

function createNode(name: string, path: string, kind: "file" | "directory", exists: boolean): ScopeNode {
  return { name, path, kind, exists, children: new Map() }
}

function ensureNode(parent: ScopeNode, segments: readonly string[], finalKind: "file" | "directory", exists: boolean): ScopeNode {
  let current = parent
  for (const [index, segment] of segments.entries()) {
    const isFinal = index === segments.length - 1
    const kind = isFinal ? finalKind : "directory"
    const path = joinPath(current.path, segment)
    let child = current.children.get(segment)
    if (!child) {
      child = createNode(segment, path, kind, exists && isFinal)
      current.children.set(segment, child)
    }
    if (exists && isFinal) child.exists = true
    current = child
  }
  return current
}

function normalizeDirectoryPath(path: string): string {
  if (!path) return ""
  return normalizeResource("read", path)
}

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child
}

function isIgnoredDirectory(name: string, isDirectory: boolean): boolean {
  return isDirectory && (name === ".git" || name === "node_modules")
}

function assertInWorkspace(workspace: string, candidate: string): void {
  const root = resolve(workspace)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) throw new Error("Requested path is outside the workspace.")
}
