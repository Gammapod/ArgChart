---
type: Implementation roadmap
title: ArgChart milestone plan
description: Product decisions, graph semantics, and milestone sequence for ArgChart.
tags: [roadmap, architecture, opencode, plugin]
status: draft
---

# ArgChart Milestone Plan

## Product Decision Record

ArgChart will be an OpenCode V2 plugin with a terminal-first interactive UI. Its first deliverable is a read-only graph of which agents can launch which subagents.

ArgChart distinguishes three complementary views:

- **Effective runtime view:** the resolved agent registry and effective permissions used by OpenCode now.
- **Capability scope view:** read-only projections of the consequences of those effective permissions: delegation authority, file access, and non-file tools.
- **Source view:** the Markdown or JSONC definitions that supplied instructions and configuration. It is a deferred convenience/provenance view, not the authority for merged runtime behavior.

Do not infer runtime behavior from one source file alone. OpenCode merges configuration from multiple scopes, applies built-in defaults, and appends ordered permission rules. The last matching rule wins.

## Product Priorities

ArgChart prioritizes visualization of configuration consequences over configuration manipulation. The next product sequence is capability-scope foundation, file scope, tool scope, companion web visualization, then runtime activity. Configuration editing is deliberately deferred.

- **High:** read-only effective capability scope: what an agent may delegate to, see/change in the workspace, and invoke as a tool.
- **Medium:** a companion web renderer over the same server analysis contract, especially for full-graph visualization and richer interaction.
- **Later:** runtime session activity overlay after the static views are stable.
- **Low:** source provenance and a convenience action to open a confidently identified agent configuration file. Persistent editing and graph gestures that change permissions are not planned work.

## OpenCode Research Baseline

Use OpenCode V2 documentation and exported types as the source of truth. V1 plugin examples use incompatible names and shapes, including singular `agent`/`permission` configuration.

| Topic | Decision-relevant finding | Source |
| --- | --- | --- |
| Server plugins | Plugins use `Plugin.define({ id, setup })`. The context exposes `ctx.agent.list()`, `ctx.agent.get()`, transforms, permissions, events, storage, and custom RPC. | [Build plugins](https://opencode.ai/v2/docs/build/plugins/) |
| Agent configuration | Current V2 agent configuration uses `agents` and `permissions`. Agents may be primary, subagent, or all. Markdown bodies provide the system instructions. | [Agents](https://opencode.ai/v2/docs/agents/) |
| Permission model | Rules are ordered `{ action, resource, effect }`; effects are `allow`, `ask`, and `deny`; the last matching rule wins. The `subagent` action controls which child agent IDs may be launched. | [Permissions](https://opencode.ai/v2/docs/permissions/) |
| Permission resources | `read` and `edit` resources are paths; `glob` is a glob query and `grep` is a regular-expression query. `shell`, `skill`, MCP, and other actions need action-specific projections rather than a path tree. | [Permission actions](https://opencode.ai/v2/docs/permissions/#actions) |
| Scope evaluation | `ctx.permission.assert()` evaluates a session-bound request and may prompt or reject. It is unsuitable for read-only hypothetical scope evaluation, which must prospectively evaluate the runtime-resolved ordered rules. | [Plugin permission API](https://opencode.ai/v2/docs/build/plugins/#permissions) |
| Scope inventories | The plugin context exposes filesystem/session APIs and skill and MCP inventories (`ctx.skill`, `ctx.mcp.list()`). Some HTTP API surfaces are experimental. | [Filesystem API](https://opencode.ai/v2/docs/api#filesystem), [skill API](https://opencode.ai/v2/docs/api#skill), [MCP API](https://opencode.ai/v2/docs/api#mcp) |
| Configuration format | JSON and JSONC are supported. Configuration is merged by scope, and the published schema is the authoritative syntax definition. | [Configuration](https://opencode.ai/v2/docs/config/) and [schema](https://opencode.ai/config.json) |
| Terminal UI | CLI plugins provide OpenTUI/Solid routes, panels, dialogs, slots, keyboard commands, and typed location data. They are the supported way to customize OpenCode's terminal UI. | [CLI plugins](https://opencode.ai/v2/docs/build/plugins/cli/) |
| Plugin communication | Plugin RPC supports a shared typed contract usable by CLI plugins and later external clients. | [JavaScript client and plugin RPC](https://opencode.ai/v2/docs/build/client/) |
| External client | `@opencode/client` can call the authenticated OpenCode HTTP API and receive live events. This supports a future companion web viewer, but does not make browser UI embedding a plugin feature. | [HTTP API](https://opencode.ai/v2/docs/api) |

## Communication Graph Semantics

### Nodes

Each node represents an effective agent returned by OpenCode's agent registry. Include built-in and custom agents, and display at least ID, description, mode, model when present, and hidden/disabled state when exposed by the runtime data.

### Directed edges

An edge `A -> B` means agent `A` may attempt to launch `B` as a subagent.

To render it correctly:

1. The target must support subagent use: mode `subagent` or `all`.
2. Evaluate `A`'s effective `subagent` permission rules against B's agent ID.
3. Render the result as `allow`, `ask`, or `deny`.
4. Explain the matching global, agent-specific, and session-scoped rules where that provenance is available.
5. Label wildcard-derived edges as such. A rule that allows `subagent: *` is not equivalent to individually authored edges.

The edge expresses configured permission potential, not a guarantee of execution. Subagent depth, policy enforcement, session state, and runtime availability can still prevent a launch.

Do not model a separate "respond" permission edge in the MVP. A launched subagent reports to its parent through the normal child-session flow; this is part of the invocation relationship rather than a separately configured agent-to-agent permission.

## Milestones

**Status at the M9 checkpoint:** M0 through M5 are complete. M9 currently provides recent-session recovery, live active/approval status, observed child-session relationships, session navigation, and a safe current-session prompt/response preview. Durable event history, fork classification, and file/tool activity remain deferred.

### M0: Plugin Skeleton and Research Contract

**Outcome:** a loadable local V2 plugin package with separate server and CLI entry points, plus type-checking and a documented OpenCode version target.

**Work:**

- Create a package that exports a server plugin from `.` and a CLI plugin from `./tui`.
- Use `@opencode/plugin` for server code and `@opencode/plugin/tui` for terminal code.
- Define a shared domain vocabulary for agent IDs, graph nodes, edges, edge decisions, and explanation records.
- Pin or declare a tested OpenCode V2 compatibility range. Do not copy V1 plugin API examples.
- Add a minimal local installation path under `.opencode/plugins/` for development.

**Reasoning:** OpenCode's server plugin and terminal plugin are separate extension surfaces. Keeping analysis in server code and rendering in CLI code leaves a stable path to a future companion web client through plugin RPC.

**References:** [Build plugins](https://opencode.ai/v2/docs/build/plugins/), [CLI plugins](https://opencode.ai/v2/docs/build/plugins/cli/), [Plugin configuration](https://opencode.ai/v2/docs/plugins/).

### M1: Effective Agent Inventory

**Outcome:** an analysis service that lists the active, resolved agents for the current OpenCode location.

**Work:**

- Read agents through `ctx.agent.list()` and individual agents through `ctx.agent.get()` when necessary.
- Normalize runtime data into an ArgChart graph-node model with only the fields required for analysis and rendering; add targeted diagnostics deliberately rather than exposing unrestricted runtime payloads.
- Subscribe to relevant location/configuration events or expose an explicit refresh path.
- Clearly label this data as the effective runtime view, not the contents of a specific configuration file.

**Acceptance criteria:** the service reports built-in and custom agents and correctly represents their selectable modes.

**Reasoning:** the runtime registry is the most reliable starting point for answering "which agents exist now?" Source files alone cannot account for configuration merging and built-in agents.

**References:** [Plugin agent API](https://opencode.ai/v2/docs/build/plugins/#agent), [Agents](https://opencode.ai/v2/docs/agents/).

### M2: Read-Only Communication Graph Analysis

**Outcome:** a directed graph model that explains agent-to-subagent launch permissions.

**Work:**

- Evaluate the effective `subagent` rules for every eligible source-target agent pair.
- Preserve `allow`, `ask`, and `deny`; do not reduce `ask` to a boolean.
- Support wildcard rules and explain the final matching rule and precedence order.
- Record non-permission constraints separately, including target mode and known runtime depth limits.
- Add focused unit tests for broad rules followed by narrow exceptions, since last-match-wins is essential behavior.

**Acceptance criteria:** a broad deny followed by a targeted allow produces the targeted allowed edge; a broad allow followed by a targeted deny produces the targeted denied edge; primary-only targets are not rendered as callable subagents.

**Reasoning:** the V2 permission system's `subagent` action is the authoritative representation of possible child-agent calls. Configuration order is meaningful.

**References:** [Permissions actions and matching](https://opencode.ai/v2/docs/permissions/#actions), [Agent modes and subagents](https://opencode.ai/v2/docs/agents/#modes), [Plugin permissions API](https://opencode.ai/v2/docs/build/plugins/#permissions).

### M3: Terminal-First Interactive Viewer

**Outcome:** a usable OpenTUI graph viewer with keyboard-first interaction.

**Work:**

- Add a CLI-plugin route or session panel dedicated to ArgChart.
- Render agent nodes and directed edges using terminal-appropriate layout and accessible status styling.
- Support focus movement, agent selection, inbound/outbound edge highlighting, and a details panel.
- Show an edge's final decision and a concise explanation of rules and constraints.
- Add commands or keybindings to open the viewer and refresh its data.

**Acceptance criteria:** a user can open ArgChart, select an agent, see its permitted/approval-required/denied launch relationships, and inspect why any displayed edge has its state without leaving the terminal.

**Reasoning:** OpenCode officially supports terminal UI extension through its CLI plugin API. This validates the core interaction model before considering a browser renderer.

**References:** [CLI routes and tabs](https://opencode.ai/v2/docs/build/plugins/cli/#routes-and-tabs), [CLI session panels](https://opencode.ai/v2/docs/build/plugins/cli/#session-panels), [CLI commands and keymaps](https://opencode.ai/v2/docs/build/plugins/cli/#commands-and-keymaps), [CLI dialogs](https://opencode.ai/v2/docs/build/plugins/cli/#dialogs-and-toasts).

### M4: Capability Scope Foundation

**Outcome:** a shared, read-only capability evaluator that explains an effective agent rule decision for an arbitrary action/resource pair and supplies action-specific projections.

**Work:**

- Generalize the current `subagent` evaluator without weakening its graph-specific target-mode constraints.
- Define a stable decision/explanation contract: action, normalized resource, `allow`/`ask`/`deny`, final matching rule, and ordered-rule explanation.
- Preserve documented wildcard, whole-value matching, last-match-wins, and default-`ask` semantics.
- Define action-specific normalization and projection boundaries. Paths support file projections; `glob` and `grep` are query capabilities; shell commands, skills, MCP tools, and agent delegation are separate projections.
- Evaluate only the runtime-resolved effective agent rules. Do not call `ctx.permission.assert()` for hypothetical scope because it is session-bound and may prompt.
- Add invariants and unit tests for arbitrary actions, rule order, defaults, and action/resource normalization before filesystem traversal or tool UI work.

**Acceptance criteria:** the server can return an explained prospective decision for a selected agent and supplied action/resource pair, while the current communication graph continues to preserve its existing behavior.

**Reasoning:** delegation, files, and tools all derive from ordered effective permission rules, but their resources do not share one meaning. A single evaluator with deliberately specialized projections avoids duplicating matching logic or misrepresenting query and command permissions as file access.

**References:** [Permissions](https://opencode.ai/v2/docs/permissions/), [permission actions](https://opencode.ai/v2/docs/permissions/#actions), [Plugin permission API](https://opencode.ai/v2/docs/build/plugins/#permissions).

### M5: File Scope Explorer

**Outcome:** a read-only, selected-agent file-tree projection answering what workspace code the agent can read or edit.

**Work:**

- Traverse the workspace lazily and evaluate existing paths with the M4 evaluator for `read` and `edit`.
- Represent `allow`, `ask`, and `deny` independently for each applicable action.
- Provide an agent-perspective mode that hides denied paths and collapses accessible directories as far as possible; label hidden paths as absent **or** denied.
- Provide a diagnostic mode that shows denied and approval-required paths with their explanations.
- Add a keyboard **show more info** drill-in for the focused tree row. Start with effective read/edit decisions, ordered matching rules, and structure-specific diagnostics; leave room for later cross-capability warnings and analyses.
- Keep `glob` and `grep` out of access-state tree styling; present them as query capabilities linked to the same scope view.
- Cache evaluations, avoid eager full-workspace evaluation, and distinguish existing paths from possible future paths matched by wildcards.

**Acceptance criteria:** a user can select an agent and inspect a responsive, explainable project-tree view of effective read/edit scope, including a clear distinction between allow, ask, and deny.

**Reasoning:** a file tree is the correct projection for path permissions, not an all-agents-to-all-files graph. It must remain truthful about hidden paths and scalable for real repositories.

**References:** [Permission actions](https://opencode.ai/v2/docs/permissions/#actions), [directories and path normalization](https://opencode.ai/v2/docs/permissions/#directories), [filesystem API](https://opencode.ai/v2/docs/api#filesystem).

### M6: Tool Scope Explorer

**Outcome:** a read-only selected-agent view of non-file capability scope.

**Work:**

- Project shell permission rules as command capability states, without implying that an arbitrary shell pattern is a filesystem path.
- Inventory available skills through `ctx.skill` and MCP servers/tools through `ctx.mcp.list()`, then evaluate and explain their relevant permission actions/resources.
- Present `glob` and `grep` as discovery and search query capabilities rather than file-access grants.
- Include other runtime-exposed non-file actions only when their action/resource semantics and inventories are documented; label unavailable inventory separately from denied permission.
- Reuse M4 decisions and explanations rather than creating a second policy model.

**Acceptance criteria:** a selected agent's scope view identifies its effective shell, skill, MCP, and query capabilities, preserving the distinction between available inventory, `allow`, `ask`, and `deny`.

**Reasoning:** this completes the practical question “what can this agent do?” without conflating tools with source-code visibility.

**References:** [Permission actions](https://opencode.ai/v2/docs/permissions/#actions), [skill API](https://opencode.ai/v2/docs/api#skill), [MCP API](https://opencode.ai/v2/docs/api#mcp).

### M7: Optional Companion Web Viewer (Deferred)

**Outcome:** a browser-specific viewer that reuses the ArgChart analysis contract and interaction semantics.

**Work:**

- Keep the server-side graph analysis behind typed plugin RPC.
- Build a browser renderer independently from OpenTUI while preserving graph and scope states, explanations, filters, and selection semantics.
- Prioritize full-graph topology, click-driven filters, multi-hop inspection, node positioning, and session/activity visualization when it becomes available.
- Connect through OpenCode's authenticated HTTP API and pairing flow.
- Do not rely on undocumented plugin static-asset serving or browser UI injection.

**Reasoning:** OpenCode documents terminal UI plugins, custom RPC, and external HTTP clients, but not a browser/desktop UI plugin embedding surface. A companion client is maintainable; an ad hoc HTTP server inside a plugin is technically possible but is not a stable extension contract. The web viewer is a renderer and input surface over shared ArgChart analysis, not a second policy-analysis platform.

**References:** [Plugin RPC client](https://opencode.ai/v2/docs/build/client/#plugin-rpc), [HTTP API](https://opencode.ai/v2/docs/api), [CLI plugin API](https://opencode.ai/v2/docs/build/plugins/cli/).

### M8: Source Convenience and Provenance (Low Priority)

**Outcome:** optional source discovery and an “open agent configuration file” convenience action when ArgChart can identify a source confidently.

**Work:**

- Discover relevant Markdown and JSONC agent definitions and report their provenance relative to the effective runtime agent.
- Explicitly label mixed or merged sources as ambiguous; never select a file automatically in those cases.
- Open a known configuration file through the host/editor integration when available. Do not parse or write files solely to support this convenience.

**Acceptance criteria:** an agent with one confidently identified source can offer an open-source action; ambiguous provenance is explained without a misleading action.

**Reasoning:** source inspection is useful context, but it is not required to understand effective capability scope and is not a prerequisite for ArgChart's primary product direction.

**References:** [Agent file formats](https://opencode.ai/v2/docs/agents/#formats), [configuration locations and merging](https://opencode.ai/v2/docs/config/#locations).

### M9: Runtime Session Activity Overlay (Partially implemented)

**Outcome:** an optional, read-only runtime overlay that shows actual child-session activity on top of the static communication graph.

**Work:**

- Derive agent activity from running and active sessions; agents are configuration definitions, so an agent's runtime state is an aggregate of its sessions rather than a single process state.
- Project session hierarchy through `SessionInfo.id`, `parentID`, and `agent` to identify child sessions associated with an agent-to-agent communication relationship.
- Subscribe to session and permission events to represent a delegation lifecycle: created/pending, active, awaiting approval, succeeded, failed, or interrupted.
- Record the parent and child agent identities when a child session is created. Do not infer the historical parent agent later if the parent session may have switched agents.
- Distinguish ordinary child-session delegation from forks or other hierarchy mechanisms when the runtime event/session data provides that distinction.
- Attach active-session counts, latest outcome, timestamps, pending approval state, and selected session IDs as a runtime overlay; keep configured effective permission potential separate from observed activity.
- Decide whether to persist a compact normalized event history through plugin storage. Live subscriptions alone cannot provide an ArgChart timeline for periods when the plugin was not observing.

**Acceptance criteria:** a user can select a configured graph edge and see its current child-session activity plus its latest observed outcome without confusing this data with the edge's configured permission decision.

**Caveats:**

- A configured edge means a launch may be attempted; it does not guarantee a session launch or successful execution.
- Parent-child session hierarchy is strong evidence of a relationship, but not every child hierarchy is necessarily a normal subagent delegation.
- Session policies, approvals, depth limits, agent switching, and server availability can affect actual outcomes beyond the static graph.
- Historical event completeness requires durable event capture or a supported session-log recovery path; the session-log API is experimental.

**Reasoning:** session and event APIs can provide real-time operational context without changing ArgChart's static-analysis contract. Keeping activity as a separate overlay prevents a transient failed or active run from being mistaken for a configuration permission result.

**References:** [Plugin event API](https://opencode.ai/v2/docs/build/plugins/), [CLI event data](https://opencode.ai/v2/docs/build/plugins/cli/#events), [Session API](https://opencode.ai/v2/docs/api#session), [event stream API](https://opencode.ai/v2/docs/api#event), [permission API](https://opencode.ai/v2/docs/api#permission).

### M10: Robust Nested-Exception Analysis (Conditional)

**Trigger:** begin this milestone when testing identifies a false-positive or false-negative nested-exception marker in the file-scope explorer.

**Outcome:** replace the current representative-path heuristic for the file-scope `*` marker with a sound, explainable analysis of whether descendants can have a different effective decision for each action.

**Work:**

- Define the supported path-pattern subset and its witness/region semantics explicitly.
- Analyze ordered, last-match-wins rules without relying on one synthesized descendant path.
- Preserve independent read and edit markers, and explain the rule or rule region responsible for each marker.
- Add regression fixtures for overlapping `*`, `**`, `?`, literal-file, and later-override patterns.

**Reasoning:** the current marker is useful targeted guidance, but it is heuristic. It must not silently become an authority on all possible descendants until its pattern analysis is validated against a counterexample.

## Implementation Principles

- Prefer OpenCode runtime APIs for effective behavior. For read-only hypothetical scope evaluation, prospectively apply the documented effective-rule semantics; do not invoke session-bound permission assertion because it can prompt or reject.
- Keep server-side graph analysis independent of terminal rendering.
- Preserve `ask` as a first-class state.
- Explain every projected decision and any future source action.
- Keep configuration writes out of the planned scope; never silently write configuration files.
- Treat unavailable inventories and ambiguous source combinations as explicit product states, not errors to guess through.
- Revalidate API assumptions against current V2 documentation and types before each milestone, because plugin and UI APIs evolve.
