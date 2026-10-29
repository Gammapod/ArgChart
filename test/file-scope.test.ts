import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { FileScopeService } from "../src/file-scope.ts"
import { node } from "./fixtures.ts"

test("file scope projects folder baselines, file exceptions, and literal virtual folders", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "argchart-file-scope-"))
  try {
    await Promise.all([
      mkdir(join(workspace, "secrets")),
      mkdir(join(workspace, "src", "backend"), { recursive: true }),
      mkdir(join(workspace, "src", "frontend", "components"), { recursive: true }),
      mkdir(join(workspace, "src", "frontend", "api"), { recursive: true }),
      mkdir(join(workspace, "tests")),
    ])
    await Promise.all([
      writeFile(join(workspace, "secrets", "secret.sct"), ""),
      writeFile(join(workspace, "src", "backend", "backend-file.txt"), ""),
      writeFile(join(workspace, "src", "frontend", "components", "component-plan.md"), ""),
      writeFile(join(workspace, "src", "frontend", "components", "component1.cmp"), ""),
      writeFile(join(workspace, "src", "frontend", "components", "component2.cmp"), ""),
      writeFile(join(workspace, "src", "frontend", "api", "clients.ts"), ""),
      writeFile(join(workspace, "src", "frontend", "api", "README.md"), ""),
    ])
    const agent = node("scoped", "all", [
      { action: "read", resource: "*", effect: "allow" },
      { action: "read", resource: "secrets/*", effect: "deny" },
      { action: "edit", resource: "*", effect: "deny" },
      { action: "edit", resource: "src/frontend/*", effect: "allow" },
      { action: "edit", resource: "src/frontend/api/*", effect: "ask" },
      { action: "edit", resource: "src/frontend/assets/*", effect: "deny" },
      { action: "edit", resource: "src/frontend/**/*.md", effect: "allow" },
      { action: "edit", resource: "src/**/*.cmp", effect: "deny" },
    ])
    const service = new FileScopeService(workspace)

    const root = await service.list(agent)
    const rootEntry = (path: string) => root.entries.find((item) => item.path === path)
    assert.deepEqual(rootEntry("secrets")?.read.decision, "deny")
    assert.equal(root.entries.some((item) => item.path.includes("/")), false)

    const frontend = await service.list(agent, "src/frontend")
    const entry = (path: string) => frontend.entries.find((item) => item.path === path)
    assert.deepEqual(entry("src/frontend/api")?.edit.decision, "ask")
    assert.equal(entry("src/frontend/assets")?.exists, false)
    assert.equal(entry("src/frontend/assets")?.edit.decision, "deny")

    const components = await service.list(agent, "src/frontend/components")
    const component = components.entries.find((item) => item.path === "src/frontend/components/component1.cmp")
    assert.deepEqual(component?.edit.decision, "deny")

    const api = await service.list(agent, "src/frontend/api")
    const readme = api.entries.find((item) => item.path === "src/frontend/api/README.md")
    assert.deepEqual(readme?.edit.decision, "allow")
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test("file scope caches a directory response until explicitly cleared", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "argchart-file-scope-"))
  try {
    await mkdir(join(workspace, "first"))
    const service = new FileScopeService(workspace)
    const agent = node("scoped", "all", [{ action: "read", resource: "*", effect: "allow" }])
    const first = await service.list(agent)
    await mkdir(join(workspace, "second"))
    assert.equal((await service.list(agent)).entries.some((entry) => entry.name === "second"), false)
    service.clearCache()
    assert.equal((await service.list(agent)).entries.some((entry) => entry.name === "second"), true)
    assert.equal(first.entries.some((entry) => entry.name === "first"), true)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test("file scope retains a denied directory that contains a more-specific allowed scope", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "argchart-file-scope-"))
  try {
    await mkdir(join(workspace, "src", "GameGameGame.Content"), { recursive: true })
    const service = new FileScopeService(workspace)
    const agent = node("content-editor", "all", [
      { action: "read", resource: "*", effect: "ask" },
      { action: "read", resource: "src/*", effect: "deny" },
      { action: "read", resource: "src/GameGameGame.Content/*", effect: "allow" },
      { action: "edit", resource: "*", effect: "ask" },
      { action: "edit", resource: "src/*", effect: "deny" },
      { action: "edit", resource: "src/GameGameGame.Content/*", effect: "allow" },
    ])

    const root = await service.list(agent)
    const src = root.entries.find((entry) => entry.path === "src")
    assert.equal(src?.read.decision, "deny")
    assert.equal(src?.edit.decision, "deny")
    assert.equal(src?.readHasNestedException, true)
    assert.equal(src?.editHasNestedException, true)

    const source = await service.list(agent, "src")
    const content = source.entries.find((entry) => entry.path === "src/GameGameGame.Content")
    assert.equal(content?.read.decision, "allow")
    assert.equal(content?.edit.decision, "allow")
    assert.equal(content?.readHasNestedException, false)
    assert.equal(content?.editHasNestedException, false)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
