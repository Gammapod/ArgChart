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

/** Read-only, lazy projection of one workspace directory for one agent. */
export class FileScopeService {
  private readonly workspace: string

  constructor(workspace: string) {
    this.workspace = workspace
  }

  async list(agent: GraphNode, requestedPath = ""): Promise<FileScopeDirectory> {
    const path = normalizeDirectoryPath(requestedPath)
    const directory = resolve(this.workspace, path)
    assertInWorkspace(this.workspace, directory)
    const root = createNode("", "", "directory", true)
    await this.readTree(directory, path, root)
    addVirtualRulePaths(root, agent.permissions)
    const entries = projectTree(root, agent)
    return { view: "effective-runtime", agentID: agent.id, path, entries }
  }

  private async readTree(directory: string, relativePath: string, parent: ScopeNode): Promise<void> {
    const diskEntries = await readdir(directory, { withFileTypes: true })
    for (const entry of diskEntries) {
      if (entry.isSymbolicLink() || isIgnoredDirectory(entry.name, entry.isDirectory())) continue
      const path = joinPath(relativePath, entry.name)
      const node = ensureNode(parent, [entry.name], entry.isDirectory() ? "directory" : "file", true)
      if (entry.isDirectory()) await this.readTree(resolve(directory, entry.name), path, node)
    }
  }
}

function addVirtualRulePaths(root: ScopeNode, rules: readonly PermissionRule[]): void {
  for (const rule of rules) {
    if (rule.action !== "read" && rule.action !== "edit") continue
    let resource: string
    try { resource = normalizeResource(rule.action, rule.resource) } catch { continue }
    const segments = resource.split("/")
    const wildcardAt = segments.findIndex((segment) => /[*?]/.test(segment))
    // A glob has no concrete leaf. Materialize its literal directory prefix,
    // if any, so a rule such as assets/* can be represented truthfully.
    const literalPath = wildcardAt < 0 ? segments : segments.slice(0, wildcardAt)
    if (!literalPath.length) continue
    ensureNode(root, literalPath, wildcardAt < 0 ? "file" : "directory", false)
  }
}

function projectTree(root: ScopeNode, agent: GraphNode): FileScopeEntry[] {
  const rootState = scopeState(root, agent)
  return projectChildren(root, rootState, agent, 0)
}

function projectChildren(parent: ScopeNode, parentState: ScopeState, agent: GraphNode, depth: number): FileScopeEntry[] {
  const output: FileScopeEntry[] = []
  for (const node of sortedChildren(parent)) {
    const state = scopeState(node, agent)
    const children = node.kind === "directory" ? projectChildren(node, state, agent, depth + 1) : []
    // Directories establish useful project structure. Actual files are only
    // shown when they differ from their containing scope; virtual literals are
    // always shown because the rule explicitly names them.
    const show = node.kind === "directory" || !node.exists || !sameState(state, parentState)
    if (!show) continue
    output.push({ path: node.path, name: node.name, depth, kind: node.kind, exists: node.exists, ...state })
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
