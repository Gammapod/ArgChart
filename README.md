---
type: Project overview
title: ArgChart
description: A terminal-first OpenCode plugin for exploring agent configuration as an interactive graph.
tags: [opencode, plugin, terminal-ui, agent-configuration]
status: active
---

# ArgChart

ArgChart is a terminal-first OpenCode plugin for exploring effective OpenCode agent configuration as an interactive graph.

ArgChart is a read-only inspector of effective OpenCode agent configuration and recent runtime activity. It inventories resolved agents, explains directed subagent-launch relationships, projects read/edit file scope, and overlays current or recent session state without changing configuration.

## Current capabilities

- Inventory resolved built-in and custom agents from the effective runtime registry.
- Select an agent and inspect its inbound and outbound subagent-launch relationships.
- Preserve and explain `allow`, `ask`, and `deny` decisions using OpenCode's ordered, last-match-wins permission semantics.
- Refresh the inventory and graph in the terminal viewer.
- Inspect a selected agent's concise local topology, including virtual User selection edges.
- Inspect a lazy, explainable project-tree projection of the selected agent's effective read and edit scope.
- See the current or most recent session for each agent and observed outbound child session for each relationship.
- Detect pending permission requests as approval status, while leaving OpenCode's normal approval flow in control.
- Open a represented session from the dashboard and preview its latest user/delegating prompt plus assistant text response.
- Refresh runtime status automatically from OpenCode session and permission events; optionally disable automatic agent-following.
- Export a filtered Mermaid snapshot as `argchart.mmd`, with overwrite confirmation.

Runtime activity is a best-effort overlay: ArgChart recovers the 100 most recent non-archived workspace sessions, but does not persist its own detailed event history. Child-session hierarchy is observed runtime evidence, not proof that a particular configured permission caused a launch.

ArgChart does **not** yet parse or attribute Markdown, JSON, or JSONC source files; source inspection and safe editing remain future milestones.

## Goals

- Provide an interactive terminal UI for agent configuration.
- Make agent-to-agent communication and subagent permissions understandable.
- Distinguish effective runtime behavior from the configuration sources that define it.
- Support pure Markdown agent definitions and pure JSONC configuration before attempting mixed-source editing.
- Keep source provenance, comprehensive runtime file/tool observation, and persistent edits as separate milestones.

## Non-Goals for the MVP

- Editing agent instructions or permissions.
- A browser or desktop-native GUI.
- Full support for every possible merged OpenCode configuration source.
- A complete filesystem or tool-execution audit trail.

## Product Direction

The terminal interface is the primary product. A future browser viewer, if needed, should share the same graph model, state semantics, and interaction design while using a browser-specific renderer.

See [docs/milestone_plan.md](docs/milestone_plan.md) for the implementation roadmap, [docs/architecture.md](docs/architecture.md) for the decision record, [docs/setup.md](docs/setup.md) for local setup, and [docs/invariants.md](docs/invariants.md) for test traceability.
