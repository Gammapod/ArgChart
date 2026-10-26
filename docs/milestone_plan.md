# ArgChart Milestone Plan

## Product Decision Record

ArgChart will be an OpenCode V2 plugin with a terminal-first interactive UI. Its first deliverable is a read-only graph of which agents can launch which subagents.

The graph must distinguish two views:

- **Effective runtime view:** the resolved agent registry and effective permissions used by OpenCode now.
- **Source view:** the Markdown or JSONC definitions that supplied instructions and configuration. This is required for safe future editing, but it is not the authority for merged runtime behavior.

Do not infer runtime behavior from one source file alone. OpenCode merges configuration from multiple scopes, applies built-in defaults, and appends ordered permission rules. The last matching rule wins.

## Supported Scope

Initial source support, in priority order:

1. Pure Markdown agent definitions in `.opencode/agents/**/*.md`.
2. Pure JSONC agent definitions under `agents` in `opencode.jsonc`.
3. Read-only mixed-source effective views, with ambiguous provenance explicitly labeled.

Initial source exclusions:

- Persistent editing of mixed Markdown/JSONC configurations.
- Automatic source selection when multiple configuration layers contribute to an agent.
- File access visualization and editing.
- Browser UI implementation.

## OpenCode Research Baseline

Use OpenCode V2 documentation and exported types as the source of truth. V1 plugin examples use incompatible names and shapes, including singular `agent`/`permission` configuration.

| Topic | Decision-relevant finding | Source |
| --- | --- | --- |
| Server plugins | Plugins use `Plugin.define({ id, setup })`. The context exposes `ctx.agent.list()`, `ctx.agent.get()`, transforms, permissions, events, storage, and custom RPC. | [Build plugins](https://opencode.ai/v2/docs/build/plugins/) |
| Agent configuration | Current V2 agent configuration uses `agents` and `permissions`. Agents may be primary, subagent, or all. Markdown bodies provide the system instructions. | [Agents](https://opencode.ai/v2/docs/agents/) |
| Permission model | Rules are ordered `{ action, resource, effect }`; effects are `allow`, `ask`, and `deny`; the last matching rule wins. The `subagent` action controls which child agent IDs may be launched. | [Permissions](https://opencode.ai/v2/docs/permissions/) |
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
- Normalize runtime data into an ArgChart graph-node model without losing raw data needed for diagnostics.
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

### M4: Configuration Source Inspection

**Outcome:** source-level instruction and configuration inspection for unambiguous pure Markdown and pure JSONC projects.

**Work:**

- Discover relevant OpenCode configuration locations and agent files.
- Parse Markdown frontmatter and retain the body as the prose instruction text.
- Parse JSONC `agents` entries while preserving comments and formatting data for later editing.
- Compare sources to the effective runtime view and label inherited, merged, overridden, or unresolved fields.
- Explicitly detect mixed-source ambiguity rather than making unsafe attribution claims.

**Acceptance criteria:** the details view can show prose instructions for an agent whose source is unambiguous Markdown or JSONC; an agent with multiple contributing sources displays that limitation clearly.

**Reasoning:** plugins have no documented persistent config-file read/write API. Source parsing is application-owned work and must remain separate from runtime transforms.

**References:** [Agent file formats](https://opencode.ai/v2/docs/agents/#formats), [Configuration locations and merging](https://opencode.ai/v2/docs/config/#locations), [configuration schema](https://opencode.ai/config.json).

### M5: Safe Editing for Unambiguous Sources

**Outcome:** opt-in editing of prose instructions and selected permission rules for a single, known source file.

**Work:**

- Enable edits only when ArgChart can identify one writable Markdown or JSONC source without ambiguity.
- Use a staged proposal/review flow that shows the precise Markdown or JSONC changes before writing.
- Preserve JSONC comments and formatting where feasible; preserve Markdown frontmatter and body boundaries.
- Validate changed JSONC against the current OpenCode schema before write.
- Write atomically, report failures, then trigger or instruct an OpenCode location reload.
- Keep runtime preview changes explicitly separate from persisted source changes.

**Acceptance criteria:** double-clicking an unambiguous source-backed agent opens an editable instruction view; saving shows a diff, validates it, writes only after confirmation, and refreshes the effective graph.

**Reasoning:** `ctx.agent.transform()` changes runtime state but is not a persistent configuration editor. Safe persistent changes require source provenance, validation, and a deliberate reload.

**References:** [Plugin agent transforms](https://opencode.ai/v2/docs/build/plugins/#agent), [configuration schema](https://opencode.ai/config.json), [location reload API](https://opencode.ai/v2/docs/api#location.reload).

### M6: Permission Editing Through Graph Gestures

**Outcome:** graph interactions can propose, but not silently apply, permission-rule changes.

**Work:**

- Treat drawing or removing an edge as a request to modify ordered `subagent` rules, not as a direct edge mutation.
- Generate the smallest explicit rule change that achieves the requested effect without hiding wildcard side effects.
- Display rule order and all affected visible edges before confirmation.
- Restrict persistent changes to the M5 unambiguous source cases.
- Add regression tests for rule reordering and wildcard interactions.

**Acceptance criteria:** a user can propose an `allow`, `ask`, or `deny` result for one eligible target and review the exact configuration diff plus affected graph edges before any write.

**Reasoning:** edges are derived from ordered matching rules. Direct manipulation without an explanation would create surprising broader behavior.

**References:** [Permission rule ordering](https://opencode.ai/v2/docs/permissions/#matching), [Permissions configuration](https://opencode.ai/v2/docs/permissions/#configure).

### M7: File Access Exploration (Deferred)

**Outcome:** a feasible, scalable design for showing file permissions, only after the communication graph is stable.

**Work:**

- Prototype lazy filesystem traversal and per-path effective `read` and `edit` evaluation.
- Represent `allow`, `ask`, and `deny` rather than a binary accessible/inaccessible state.
- Prefer a filterable file tree and agent/file detail views over a literal all-agents-to-all-files graph.
- Cache permission evaluations and avoid eagerly evaluating every path in large workspaces.
- Document the difference between existing-file evaluation and future paths implied by wildcard rules.

**Exit decision:** proceed only if the interaction remains understandable and responsive on representative repositories.

**Reasoning:** permissions use resource patterns, not a stored accessible-file inventory. Enumerating a workspace and evaluating every path is possible but may create unacceptable visual and performance complexity.

**References:** [Permission actions](https://opencode.ai/v2/docs/permissions/#actions), [Directories and path normalization](https://opencode.ai/v2/docs/permissions/#directories).

### M8: Optional Companion Web Viewer (Deferred)

**Outcome:** a browser-specific viewer that reuses the ArgChart analysis contract and interaction semantics.

**Work:**

- Keep the server-side graph analysis behind typed plugin RPC.
- Build a browser renderer independently from OpenTUI while preserving graph states, edge explanations, and editing review semantics.
- Connect through OpenCode's authenticated HTTP API and pairing flow.
- Do not rely on undocumented plugin static-asset serving or browser UI injection.

**Reasoning:** OpenCode documents terminal UI plugins, custom RPC, and external HTTP clients, but not a browser/desktop UI plugin embedding surface. A companion client is maintainable; an ad hoc HTTP server inside a plugin is technically possible but is not a stable extension contract.

**References:** [Plugin RPC client](https://opencode.ai/v2/docs/build/client/#plugin-rpc), [HTTP API](https://opencode.ai/v2/docs/api), [CLI plugin API](https://opencode.ai/v2/docs/build/plugins/cli/).

## Implementation Principles

- Prefer OpenCode runtime APIs for effective behavior; do not reimplement permission semantics if an OpenCode evaluation API is available.
- Keep server-side graph analysis independent of terminal rendering.
- Preserve `ask` as a first-class state.
- Explain every edge and every proposed edit.
- Never silently write configuration files.
- Treat unsupported source combinations as explicit product states, not errors to guess through.
- Revalidate API assumptions against current V2 documentation and types before each milestone, because plugin and UI APIs evolve.
