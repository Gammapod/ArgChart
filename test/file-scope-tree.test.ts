import assert from "node:assert/strict"
import test from "node:test"
import type { FileScopeDirectory, FileScopeEntry, PermissionDecision } from "../src/domain.ts"
import { buildFileScopeTree, clampFileScopeSelection } from "../src/tui/file-scope-tree.ts"

const decision = (value: PermissionDecision["decision"]): PermissionDecision => ({ action: "read", resource: "example", decision: value, matchingRules: [], summary: value })
const entry = (path: string, kind: FileScopeEntry["kind"], read: PermissionDecision["decision"], edit: PermissionDecision["decision"]): FileScopeEntry => ({
  path,
  name: path.split("/").at(-1)!,
  kind,
  exists: true,
  read: decision(read),
  edit: decision(edit),
  readHasNestedException: false,
  editHasNestedException: false,
})
const directory = (path: string, entries: readonly FileScopeEntry[]): FileScopeDirectory => ({ view: "effective-runtime", agentID: "agent", path, entries })

test("file-scope tree retains denied directories, hides denied files, and projects loaded children", () => {
  const scopes = {
    "": directory("", [entry("src", "directory", "deny", "deny"), entry("secret.txt", "file", "deny", "deny")]),
    src: directory("src", [entry("src/allowed.ts", "file", "allow", "deny")]),
  }
  const collapsed = buildFileScopeTree(scopes, new Set(), new Set())
  assert.deepEqual(collapsed.map((row) => row.entry.path), ["src"])

  const expanded = buildFileScopeTree(scopes, new Set(["src"]), new Set())
  assert.deepEqual(expanded.map((row) => [row.entry.path, row.depth]), [["src", 0], ["src/allowed.ts", 1]])
})

test("file-scope tree selection remains within visible bounds", () => {
  assert.equal(clampFileScopeSelection(4, []), 0)
  assert.equal(clampFileScopeSelection(4, [{ entry: entry("src", "directory", "allow", "allow"), depth: 0, expanded: false, loading: false }]), 0)
})
