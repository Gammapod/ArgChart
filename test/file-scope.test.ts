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
    const entry = (path: string) => root.entries.find((item) => item.path === path)
    assert.deepEqual(entry("secrets")?.read.decision, "deny")
    assert.deepEqual(entry("src/frontend")?.edit.decision, "allow")
    assert.deepEqual(entry("src/frontend/components/component1.cmp")?.edit.decision, "deny")
    assert.deepEqual(entry("src/frontend/api")?.edit.decision, "ask")
    assert.deepEqual(entry("src/frontend/api/README.md")?.edit.decision, "allow")
    assert.equal(entry("src/frontend/assets")?.exists, false)
    assert.equal(entry("src/frontend/assets")?.edit.decision, "deny")
    assert.equal(root.entries.some((item) => item.name.includes(".env")), false)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
