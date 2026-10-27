---
type: Project overview
title: ArgChart
description: A terminal-first OpenCode plugin for exploring agent configuration as an interactive graph.
tags: [opencode, plugin, terminal-ui, agent-configuration]
status: draft
---

# ArgChart

ArgChart is a terminal-first OpenCode plugin for exploring agent configuration as an interactive graph.

The initial product is a read-only agent communication graph. It will show the agents available in an OpenCode location and the directed relationships that permit one agent to launch another. The interface will explain whether an edge is allowed, requires approval, or is denied, and which effective permission rules produced that result.

## Goals

- Provide an interactive terminal UI for agent configuration.
- Make agent-to-agent communication and subagent permissions understandable.
- Distinguish effective runtime behavior from the configuration sources that define it.
- Support pure Markdown agent definitions and pure JSONC configuration before attempting mixed-source editing.
- Keep future file-access visualization and persistent edits as separate milestones.

## Non-Goals for the MVP

- Editing agent instructions or permissions.
- File-tree or file-access visualization.
- A browser or desktop-native GUI.
- Full support for every possible merged OpenCode configuration source.

## Product Direction

The terminal interface is the primary product. A future browser viewer, if needed, should share the same graph model, state semantics, and interaction design while using a browser-specific renderer.

See [docs/milestone_plan.md](docs/milestone_plan.md) for the implementation roadmap, supported configuration shapes, and the OpenCode API research behind the decisions.
