---
type: Architecture decision record
title: ArgChart architecture through M9
description: Recorded decisions and verified behavior for ArgChart's read-only effective-runtime inspector, capability dashboard, and runtime session overlay.
tags: [architecture, decisions, opencode, permissions, terminal-ui]
status: active
---

# ArgChart architecture through M9

## Current capability boundary

ArgChart is a read-only, effective-runtime inspector. It inventories the agents resolved by OpenCode for the active location, evaluates their effective permissions prospectively, and presents selected-agent relationships, read/edit file scope, and current/recent session activity in an OpenTUI dashboard.

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

### Use a selected-agent dashboard with a relationship table, not a terminal graph

The terminal route presents a stable agent rail with latest-session status, a scrollable relationship table with outbound child-session status, safe identity/context metadata, a lazy file-scope explorer, and a current-session prompt/response preview. The relationship table presents each connected agent once with independent **Calls Me** and **I Can Call** decisions. Keyboard focus supports agents, relationships, and file scope; `j`/`k` moves within the focused panel and `r` refreshes.

**Consequence:** terminal users can inspect dense relationship sets without overlapping node labels. Whole-topology graph exploration remains a web-viewer concern; Mermaid remains an explicit snapshot export.

### Model User selection and questions as virtual relationships

The effective runtime registry does not contain a user agent. For relationship, topology, and export projections, ArgChart derives a virtual **User** node. It has `User → agent` edges for `primary` and `all` agents, reflecting agents selectable directly by the user. It has no edge to `subagent`-only agents. Each agent also receives an `agent → User` relationship from its effective `question:*` permission, representing whether it can ask the user a question. Runtime `agent → agent` edges continue to represent evaluated `subagent` permissions.

**Consequence:** direct user selection is visible without misrepresenting it as an OpenCode permission rule.

### Keep relationship filtering shared with export

Topology filters control the selected-agent relationship table and Mermaid export. Defaults hide subagent-only nodes and denied relationships while retaining approval-required relationships. The table uses text labels and semantic status colors for `allow`, `ask`, and `deny`.

**Consequence:** filtering keeps dense relationship lists scannable without changing the underlying communication or question-permission semantics.

### Export complete topology as Mermaid

The **Export ArgChart Mermaid graph** command writes `argchart.mmd` in the active project directory. It includes the virtual User node and all communication edges allowed by the active filters; labels preserve `allow`, `ask`, and `deny`, while solid versus dashed syntax distinguishes allowed from non-allowed relationships. An existing export is never overwritten until the user confirms it in the terminal.

**Consequence:** export is an explicit user action and a snapshot, not a live-synchronized artifact.

### Project file scope as a directory-lazy tree

File scope loads only one directory at a time and caches results by effective agent, directory path, and permission set. The viewer composes loaded directory responses into an expandable tree, keeps denied directories visible when they can contain more-specific exceptions, and hides fully denied files in the default agent-perspective view. Read and edit decisions remain independent; a `*` marks a heuristic nested exception for that action.

**Consequence:** file-scope work and rendering remain bounded on large workspaces while users can reach nested overrides. The nested-exception heuristic is explicitly conditional work under M10.

### Expose safe agent context; defer raw instructions

The context panel displays identity, mode, model, hidden state, and description. It deliberately does not expose raw runtime instructions. The current-session panel deliberately shows only the newest user prompt and latest subsequent assistant text from the selected agent's current or recent session; reasoning, tools, shell output, and system content remain excluded.

**Consequence:** context remains safe by default, while instruction disclosure and tool capability rendering remain deliberate future product decisions.

### Overlay runtime activity without changing configured capability semantics

The server returns a safe snapshot of the 100 most recent non-archived workspace sessions, including current parent/child hierarchy and terminal outcomes. The TUI adds live active-session and session-permission state from OpenCode, refreshes from session and permission events, and never persists raw message content or an ArgChart-owned event log.

An agent status prefers an active session, then its most recently updated session. A relationship status represents the newest observed child session from the selected agent to that relationship target. Parent attribution intentionally uses the current parent session agent, not the agent at child creation. Pending permission state is `approval`; a failed permission sync is shown as `? approval` rather than treated as no pending request.

**Consequence:** configured `allow`/`ask`/`deny` remains prospective policy, while Status is a separate best-effort runtime overlay. Session hierarchy remains observed evidence, not proof that a particular subagent permission caused a child session; forks and durable detailed history remain deferred.

## Verified behavior

Manual checks through M5 confirmed that the viewer:

- lists OpenCode built-in agents and a custom Markdown-defined test agent in the effective runtime inventory;
- updates inventory and communication-edge counts after an agent is added or removed;
- presents one relationship row per visible connected agent, including independent user-selection and `question:*` decisions;
- loads file scope by directory, expands/collapses the visible tree, and retains selection while scrolling;
- distinguishes read and edit decisions, including nested exceptions and virtual rule-derived paths;
- retains each normalized agent's effective permission rules for action-specific analysis without exposing raw instruction payloads.
- recovers recent session status and hierarchy from OpenCode when the viewer opens, including activity that occurred while the viewer was closed;
- updates agent and relationship status from live session and permission events, including pending approval;
- opens the represented session from agent and relationship status, and previews only the latest allowed prompt/response text for the selected agent.

## Deferred questions

- What graph snapshot/export format best serves terminal users: plain text, Mermaid/DOT, JSON, or an OpenTUI capture?
- Should a future overview use clustering/filtering and degree summaries rather than a literal full adjacency display?
- How should source provenance be represented when Markdown, JSONC, global configuration, built-ins, and saved approvals all contribute?
- Which configuration source formats should M4 validate first beyond the already observed Markdown runtime case?
