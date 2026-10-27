---
type: Architecture decision record
title: ArgChart architecture through M3.5
description: Recorded decisions and verified behavior for ArgChart's read-only effective-runtime graph, terminal viewer, and M3.5 cleanup.
tags: [architecture, decisions, opencode, permissions, terminal-ui]
status: active
---

# ArgChart architecture through M3.5

## Current capability boundary

ArgChart is a read-only, effective-runtime inspector. It inventories the agents resolved by OpenCode for the active location, evaluates their effective `subagent` permissions, and presents the resulting communication relationships in an OpenTUI route.

It does not yet inspect or attribute a configuration source file. A custom Markdown agent observed in the effective runtime registry is evidence that OpenCode resolved it, not evidence that ArgChart has parsed its Markdown. JSON/JSONC and other custom-agent source formats have not yet been manually validated as inventory inputs.

## Decisions

### Use the effective runtime registry as the graph authority

`ctx.agent.list()` supplies resolved built-in and custom agents after OpenCode configuration merging. ArgChart normalizes this response into the graph fields needed for analysis and rendering. This is the authority for M1–M3 because one source file cannot represent built-ins, inherited settings, or merged configuration layers reliably.

**Consequence:** every displayed result is labeled `effective-runtime`; source provenance and editable configuration remain later work.

### Analyze effective rules prospectively, without invoking permissions

OpenCode resolves the agent registry and ordered agent permission rules before ArgChart receives them. ArgChart then applies OpenCode's documented wildcard, last-match-wins, and default-`ask` semantics to those resolved rules for each hypothetical source-target pair. It does not call `ctx.permission.assert()`: that API is session-bound and may prompt or reject rather than answer a read-only hypothetical query.

**Consequence:** an edge describes configured effective permission potential, not the final outcome of a particular launch. Session approvals, policies, depth, and runtime state remain external constraints.

### Keep selection state independent from rendering

The terminal viewer stores a selection state with an optional focused agent, a selected-agent collection, and an optional focused relationship. The current viewer initializes focus to the first available agent for convenience, but the state model permits no selection and future multi-selection.

**Consequence:** M4 actions, session navigation, and future graph renderers can act on selection without assuming a single list-controlled agent.

### Limit graph-node data to rendering and analysis needs

Graph nodes retain normalized identity, presentation, mode, model, hidden state, and effective permission rules. They no longer carry an unrestricted raw runtime snapshot through graph RPC responses.

**Consequence:** the normal UI avoids exposing system instructions or unrelated provider/runtime fields. Targeted diagnostics can be designed explicitly if later needed.

### Keep analysis on the server and rendering in the CLI plugin

The server owns normalization, permission analysis, and the typed `argchart.inventory.refresh` and `argchart.graph.refresh` RPC methods. The CLI plugin only requests graph data and renders it.

**Consequence:** the domain model and analyzer are reusable by a later renderer without duplicating permission semantics.

### Evaluate `subagent` permissions as ordered whole-value patterns

For each source agent and callable target (`subagent` or `all` mode), ArgChart evaluates the source's normalized effective rules. `*` matches zero or more characters, `?` one character, matching spans the complete value, the last matching rule wins, and no match is `ask`.

Each graph edge retains the final decision, final matching rule/index when present, a concise explanation, and whether the final resource pattern used wildcards.

**Consequence:** an edge is configured launch potential, not a guarantee of an eventual child session. Policies, runtime depth, session state, and agent availability can still block a launch.

### Exclude primary-only agents from callable targets

Agents in `primary` mode do not receive incoming callable graph edges. Instead, the graph records an explicit `target-mode` constraint explaining their exclusion.

**Consequence:** an omitted edge is not silently treated as a permission denial.

### Use a focused terminal relationship view, not an all-at-once diagram

The M3 route presents an agent list, the selected agent's inbound and outbound directed relationships, and explanations below. Keyboard interaction uses `j`/`k` for selection and `r` to refresh. Permission decisions use symbols and semantic status colors, with text labels and explanations so color is not the sole signal.

**Consequence:** the current UI remains legible for modest teams and establishes a scalable interaction model; a separate command provides a full exported snapshot.

### Model user selection as a virtual topology node

The effective runtime registry does not contain a user agent. For topology and export only, ArgChart derives a virtual **User** node. It has `User → agent` edges for `primary` and `all` agents, reflecting agents selectable directly by the user. It has no edge to `subagent`-only agents. Runtime `agent → agent` edges continue to represent evaluated `subagent` permissions.

**Consequence:** direct user selection is visible without misrepresenting it as an OpenCode permission rule.

### Show only possible local relationships in the topology panel

The selected-agent topology panel renders directly connected `allow` edges as solid green links and `ask` edges as dashed amber links. It omits `deny` edges. The detailed inspector remains the debugging surface for denied relationships and their final rules.

**Consequence:** the concise visual topology answers “who can communicate?” while retaining a route to the full rule-level explanation.

### Export complete topology as Mermaid

The **Export ArgChart Mermaid graph** command writes `argchart.mmd` in the active project directory. It includes the virtual User node and all communication edges allowed by the active filters; labels preserve `allow`, `ask`, and `deny`, while solid versus dashed syntax distinguishes allowed from non-allowed relationships. An existing export is never overwritten until the user confirms it in the terminal.

**Consequence:** export is an explicit user action and a snapshot, not a live-synchronized artifact.

### Apply shared topology filters to the viewer and export

Topology filtering is shared between the local terminal topology and Mermaid export. Defaults hide `subagent`-only nodes (and every connected edge), show `ask` edges, and hide `deny` edges. The viewer exposes `s`, `a`, and `d` shortcuts and palette commands for these settings; Mermaid export snapshots the active settings.

**Consequence:** the concise graph is useful by default, while debugging or complete-export views remain opt-in.

### Use deterministic three-column placement for the local graph

The local topology assigns each visible neighboring node exactly once relative to the selected agent. Inbound-only nodes, including the virtual User node, appear on the left. Outbound-only and bidirectional nodes appear on the right. A right-column node receives both directional arrow segments when it can prompt the selected agent and the selected agent can prompt it; each segment retains its own `allow`/`ask`/`deny` styling.

**Consequence:** the terminal view conveys possible return prompts without duplicating an agent across columns or requiring a general-purpose graph layout engine.

## Verified behavior

Manual checks through M3 confirmed that the viewer:

- lists OpenCode built-in agents and a custom Markdown-defined test agent in the effective runtime inventory;
- updates inventory and communication-edge counts after an agent is added or removed;
- shows allowed and denied subagent relationships and their final matching effective rules;
- retains each normalized agent's effective permission rules for analysis, though file-permission visualization is not a supported M3 view.

## Deferred questions

- What graph snapshot/export format best serves terminal users: plain text, Mermaid/DOT, JSON, or an OpenTUI capture?
- Should a future overview use clustering/filtering and degree summaries rather than a literal full adjacency display?
- How should source provenance be represented when Markdown, JSONC, global configuration, built-ins, and saved approvals all contribute?
- Which configuration source formats should M4 validate first beyond the already observed Markdown runtime case?
