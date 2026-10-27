---
type: Development and verification guide
title: ArgChart setup and smoke testing
description: Local installation, compatibility, validation, and interactive smoke-test guidance for ArgChart.
tags: [development, setup, testing, opencode, plugin]
status: active
---

# ArgChart setup and smoke testing

## Compatibility

ArgChart targets OpenCode CLI and plugin SDK `2.1.4`. OpenCode 1 does not support this plugin API or its `plugins` configuration key.

Install dependencies and run the automated checks:

```sh
npm install
npm test
npm run typecheck
```

The dependency versions declared in `package.json` are the compatibility source of truth. The TUI requires the OpenCode theme, OpenTUI, and Solid peer dependencies; missing `solid-js` prevents the TUI plugin from loading.

## Local plugin discovery

OpenCode discovers the local development plugin through these forwarding entry points:

```text
.opencode/plugins/argchart/index.ts
.opencode/plugins/argchart/tui.ts
```

They forward to `src/index.ts` and `src/tui.tsx`. Keep the forwarding layout: local discovery uses `.opencode/plugins/` to find server and TUI plugin parts.

An explicit configuration can load the same directory:

```jsonc
{
  "plugins": ["./.opencode/plugins/argchart"]
}
```

Do not use `"plugins": ["."]`: OpenCode treats it as a package source and can resolve it from the user home directory rather than this repository.

## Interactive smoke test

1. Run `npm test` and `npm run typecheck`.
2. Start `opencode` in the repository root.
3. Run `/plugins`; local `argchart` and `argchart.tui` entries should appear.
4. Run **Open ArgChart** from the command palette.
5. Confirm the viewer inventories the current effective runtime agents and renders a focused local topology.
6. Confirm `j`/`k` select agents, `r` refreshes, `s`/`a`/`d` toggle topology filters, and `i` toggles Details.
7. Run **Export ArgChart Mermaid graph**. If `argchart.mmd` exists, confirm the overwrite dialog appears and leaves the file unchanged when cancelled.

The viewer is a read-only view of configured effective permission potential. It does not guarantee that an actual subagent launch will succeed in a specific session.
