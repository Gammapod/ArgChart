---
type: Project overview
title: ArgChart
description: A terminal-first OpenCode plugin for exploring agent configuration as an interactive graph.
tags: [opencode, plugin, terminal-ui, agent-configuration]
status: draft
---

# ArgChart

ArgChart is a terminal-first OpenCode plugin for exploring effective OpenCode agent configuration as an interactive graph.

The current read-only product inventories the agents resolved for an OpenCode location and shows directed subagent-launch relationships. The terminal viewer explains whether an edge is allowed, requires approval, or is denied, and which effective permission rule produced that result.

## Current capabilities

- Inventory resolved built-in and custom agents from the effective runtime registry.
- Select an agent and inspect its inbound and outbound subagent-launch relationships.
- Preserve and explain `allow`, `ask`, and `deny` decisions using OpenCode's ordered, last-match-wins permission semantics.
- Refresh the inventory and graph in the terminal viewer.
- Inspect a selected agent's concise local topology, including virtual User selection edges.
- Export a filtered Mermaid snapshot as `argchart.mmd`, with overwrite confirmation.

ArgChart does **not** yet parse or attribute Markdown, JSON, or JSONC source files; source inspection and safe editing remain future milestones.

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

See [docs/milestone_plan.md](docs/milestone_plan.md) for the implementation roadmap, [docs/architecture.md](docs/architecture.md) for the decision record, [docs/setup.md](docs/setup.md) for local setup, and [docs/invariants.md](docs/invariants.md) for test traceability.
