import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { exportMermaidGraph } from "../src/export.ts"
import { analyzeCommunicationGraph } from "../src/graph.ts"
import { toMermaid } from "../src/mermaid.ts"
import { node } from "./fixtures.ts"

test("Mermaid export includes User and preserves decisions when requested", () => {
  const graph = analyzeCommunicationGraph({
    view: "effective-runtime",
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [node("primary", "primary", [{ action: "subagent", resource: "child", effect: "ask" }]), node("child", "subagent")],
  }, "2026-10-27T00:00:00.000Z")
  const output = toMermaid(graph, { showSubagents: true, showAskEdges: true, showDenyEdges: true })
  assert.match(output, /\["User"\]/)
  assert.match(output, /\|allow\|/)
  assert.match(output, /\|ask\|/)
})

test("Mermaid export requires an explicit overwrite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "argchart-export-"))
  const outputPath = join(directory, "argchart.mmd")
  const inventory = {
    view: "effective-runtime" as const,
    refreshedAt: "2026-10-27T00:00:00.000Z",
    nodes: [node("primary", "primary")],
  }
  try {
    await writeFile(outputPath, "existing", "utf8")
    assert.equal((await exportMermaidGraph(inventory, directory)).status, "exists")
    assert.equal(await readFile(outputPath, "utf8"), "existing")
    assert.equal((await exportMermaidGraph(inventory, directory, undefined, true)).status, "written")
    assert.match(await readFile(outputPath, "utf8"), /flowchart TD/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
