---
type: Development notes
title: ArgChart development notes
description: Temporary local-development setup and troubleshooting notes for the ArgChart plugin skeleton.
tags: [development, opencode, plugin, temporary]
status: draft
documentation_lifecycle: temporary-scratch-notes
redesign_trigger: Redesign the documentation structure when the project gains enough implementation and operational material that this guide no longer remains a concise development reference.
---

# Development

> **Temporary guide:** This is the initial scratch-notes document for the plugin skeleton. When ArgChart becomes sufficiently complex, redesign the documentation structure rather than indefinitely extending this file.

## Compatibility baseline

ArgChart targets OpenCode CLI and plugin SDK `2.1.4`. OpenCode 1 does not support this plugin API or its `plugins` configuration key.

Install dependencies and check the package:

```sh
npm install
npm run typecheck
```

## Local plugin discovery

The local development plugin is discovered from:

```text
.opencode/plugins/argchart/index.ts
.opencode/plugins/argchart/tui.ts
```

These entry points intentionally forward to `src/index.ts` and `src/tui.tsx`. Keep them: OpenCode's local plugin discovery uses the `.opencode/plugins/` layout to find the server and TUI plugins.

An explicit configuration can load the same directory:

```jsonc
{
  "plugins": ["./.opencode/plugins/argchart"]
}
```

Do not use `"plugins": ["."]`: it is treated as a package source and was resolved from the user home directory instead of this repository.

## TUI dependencies

The TUI entry requires these local development dependencies in addition to `@opencode/plugin`:

- `@opencode/theme@2.1.4`
- `@opentui/core@0.6.8`
- `@opentui/solid@0.6.8`
- `solid-js@1.9.12`

In particular, a missing `solid-js` prevents the TUI plugin from loading.

## Smoke test

1. Run `npm run typecheck`.
2. Start `opencode` in the repository root.
3. Run `/plugins`; it should show local `argchart` and `argchart.tui` entries.
4. Open the command palette and run **Open ArgChart**. The dedicated viewer opens with an agent list, directed relationships, and explanation panel.
5. Run **Refresh ArgChart agent inventory**. Its toast reports the current effective runtime agent count.
6. Run **Refresh ArgChart communication graph**. Its toast reports the effective edge count and `allow`/`ask`/`deny` breakdown.
7. Run **Export ArgChart Mermaid graph** to write `argchart.mmd` in the active project directory.

In the ArgChart viewer, use `j` and `k` to select agents, `r` to refresh, `s`/`a`/`d` to toggle subagent nodes, `ask` edges, and denied edges, and `i` to toggle the details panel. The local topology panel places inbound-only agents (including User) on the left and outbound or two-way agents on the right. It shows `allow` links as solid and `ask` links as dashed. Filters also apply to the Mermaid export; defaults hide subagent nodes and denied edges while showing `ask` edges.

The viewer and refresh commands verify the server-to-TUI RPC path, effective runtime inventory, and read-only communication analysis.
