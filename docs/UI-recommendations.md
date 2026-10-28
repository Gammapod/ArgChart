---
type: UX/UI recommendation
title: ArgChart UI recommendations
description: Dashboard, scope-explorer, topology, web-viewer, and activity-overlay recommendations for ArgChart.
tags: [ux, ui, terminal, web-viewer, topology, file-scope]
status: proposed
---

# ArgChart UI Recommendations

## Review context

ArgChart is a terminal-first, read-only inspector for effective OpenCode agent configuration. Its current viewer presents an agent navigator, selected-agent file scope, optional relationship details, and a selected-agent local topology. The product direction calls for a selected-agent dashboard in the terminal and a future companion web viewer with whole-topology exploration.

These recommendations preserve the existing distinction between effective configured capability and observed runtime activity. They are product and interaction recommendations; they do not change the permission-analysis semantics.

## Recommended terminal layout

### User-facing outcome

Users see a coherent selected-agent dashboard rather than a fixed set of competing panels. The agent navigator remains available in a stable, independently scrolling left rail. The main area presents, at once where terminal space permits:

- a compact local-topology view;
- a file-scope explorer with the most available vertical space;
- a compact tool-scope summary;
- selected-agent identity and contextual details, with room for instructions when deliberately enabled.

On smaller terminals, panels retain their identity but collapse into keyboard-focusable or tabbed regions instead of becoming unreadably narrow.

### Recommendation and reasoning

Move local topology above file scope in the main dashboard. Topology is immediate context for the selected agent and is normally compact; file scope is intrinsically unbounded and should receive expandable or remaining height. This is preferable to a simple visual swap because it establishes a reusable layout hierarchy for later tool and instruction panels.

Avoid a permanent equal-size grid. A full codebase cannot fit in a fixed-size scope panel, and the useful density of topology, file scope, tool scope, and prose varies by the selected agent and terminal size. Let the focused panel expand when a user needs depth, while retaining summary information from the other panels.

### Existing implementation details

- `src/viewer.tsx` renders the navigator and file-scope panel in a fixed `height="25%"` top row, then renders optional details and a flex-growing topology panel below. This gives local topology much of the terminal even when it contains few neighbors.
- `src/tui/agent-navigator.tsx` already provides a fixed-width (`width={34}`), independently scrolling agent navigator and is a suitable stable dashboard rail.
- `src/tui.tsx` and `src/viewer.tsx` already persist viewer and topology-filter state in terminal memory storage. Panel focus, collapse, or layout preferences can use the same pattern.
- `src/tui/details-panel.tsx` is currently a relationship explanation list located between the top row and topology. It should evolve into a compact selected-agent context panel rather than force unrelated panels to reflow.

## File-scope scalability

### User-facing outcome

Users can inspect a large repository without overlap, excessive load time, or a wall of flattened paths. They can expand directories on demand, retain their position while examining permission states, and distinguish accessible, approval-required, denied, and not-yet-loaded content.

### Recommendation and reasoning

Make file scope a real, lazy tree explorer before investing in more visual polish. Load one directory at a time; collapse directories by default; cache results by selected agent and directory; expose loading and error states at the directory level. Keep an agent-perspective default that suppresses denied content, with a diagnostic mode that can reveal denied and approval-required paths and their explanations.

Scrolling is necessary but insufficient. The current flattened projection still requires the service to traverse the workspace before rendering, so it will not scale to realistic codebases. Directory-level loading bounds both rendering and filesystem work.

### Existing implementation details

- `src/file-scope.ts` documents `FileScopeService` as a lazy projection, but `list()` calls `readTree()` recursively for every descendant before it projects the result. This is eager full-workspace traversal.
- `FileScopeService.readTree()` ignores `.git` and `node_modules`, but other large trees can still be traversed eagerly.
- `src/tui/file-scope-panel.tsx` renders `scope.entries` as a flat sequence. It has `overflow="scroll"`, but no expansion state, focus state, loading state, or directory navigation.
- The response contract in `src/domain.ts` and `src/rpc.ts` is a flattened `FileScopeDirectory.entries` array. A lazy explorer will need a directory-oriented response contract or an explicit continuation/child-loading operation.
- The M5 roadmap in `docs/milestone_plan.md` already calls for lazy traversal, caching, explainable decisions, and an agent-perspective versus diagnostic distinction; implementation should be brought into alignment with that direction.

## Unified file scope across agents

### User-facing outcome

The default scope view answers the clear question, “What can this selected agent read or edit?” Users who need broader governance insight can compare a few agents or assess overall workspace coverage without losing clarity in projects with many agents.

### Recommendation and reasoning

Keep selected-agent file scope as the default. Add unified views only as explicit alternate modes:

1. **Compare mode:** show the focused agent and a small, explicitly selected set of agents.
2. **Coverage mode:** show one workspace tree with compact aggregate badges such as read and edit counts (`R 8/24`, `E 4/24`).
3. **Drill-in:** a focused path reveals which agents contribute to the aggregate count and each agent's decision.

Do not use a permanent agent-per-column table or rely on unique colors for all agents. Both approaches become incoherent as agent count grows. Aggregate counts keep the tree scannable while focused inspection retains explainability.

### Existing implementation details

- `src/viewer.tsx` tracks a focused agent plus a selected-agent collection through `src/tui/selection.ts`. The collection provides a foundation for future explicit comparison selection.
- `FileScopeDirectory` in `src/domain.ts` is explicitly scoped to one `agentID`; a unified view requires a distinct projection type rather than overloading the single-agent response.
- Permission decisions already retain matching rules and summaries in `PermissionDecision`, enabling a path-level drill-in to remain explainable.

## Local topology

### User-facing outcome

Users recognize the selected agent as the center of a small connection map, immediately distinguish inbound, outbound, and two-way relationships, and can move focus from a connected agent into its own dashboard.

### Recommendation and reasoning

Evolve the terminal rendering into a deterministic hub-and-spoke or constellation view rather than attempting a general-purpose force-directed graph in terminal cells. Keep the selected agent centered, use left/right directional lanes, retain solid/dashed status styling for allow/ask, and collapse long neighbor lists into an inspectable overflow count. A selected neighboring node should become the dashboard focus.

This makes the terminal presentation more graph-like while preserving predictable readability, accessibility, and the existing effective-permission explanation model. It also avoids coupling the future web viewer to terminal grid constraints.

### Existing implementation details

- `src/tui/topology-panel.tsx` currently renders deterministic inbound, selected, and outbound columns.
- `src/topology.ts` provides `layoutLocalTopology()`, which correctly assigns each neighbor once and preserves independent decisions for two-way relationships.
- `docs/architecture.md` records the deliberate three-column local layout and the decision to display allow and ask relationships while keeping denied-edge diagnostics elsewhere.
- `TopologyFilters` already support subagent, ask-edge, and denied-edge visibility and should retain identical semantics in later renderers.

## Details, tools, and instructions

### User-facing outcome

Users can understand an agent's identity, operational capabilities, relationship summaries, and—where authorized—its prose instructions from one coherent context area. Sensitive raw instructions are not exposed inadvertently.

### Recommendation and reasoning

Replace the standalone relationship-details strip with a selected-agent context panel:

- identity, mode, model, and hidden state;
- inbound/outbound and decision summaries;
- compact tool-scope summary, with a focused detailed explorer;
- description by default and full instructions only through an explicit, product-approved disclosure path.

Showing raw prose instructions requires a deliberate security and provenance decision. Instructions can contain sensitive operating policy, credentials, or content inherited through merged configuration. Description and a source/provenance state are safer initial context than exposing arbitrary runtime instruction text by default.

### Existing implementation details

- `src/tui/details-panel.tsx` currently lists every relationship explanation and target constraints. It is a useful source for a focused explanation drill-in but is not yet a general agent context panel.
- `GraphNode` in `src/domain.ts` exposes identity, description, mode, model, hidden state, and permissions, but deliberately does not include raw runtime instruction content.
- `docs/architecture.md` records that unrestricted raw runtime payloads and system instructions are intentionally excluded from normal graph responses.
- M6 in `docs/milestone_plan.md` defines the planned tool-scope explorer and its action-specific permission projections.

## Web viewer direction

### User-facing outcome

The companion web viewer provides an explorable whole-agent topology while preserving the same meaning of nodes, edges, decisions, filters, and selected-agent details as the terminal. Selecting a node focuses its local topology and opens its dashboard context without losing the broader graph.

### Recommendation and reasoning

Use a global-graph-plus-inspector design:

- the main canvas shows all visible agents and relationships, with optional grouping or clustering;
- selecting an agent highlights its incident edges, mutes unrelated graph elements, and populates an inspector;
- selecting an edge exposes the configured decision, matching rule, and later activity information;
- filters and focused/multi-selection semantics match the terminal view;
- layout algorithms are web-specific and must not be shared with the terminal.

The web application should be a separate renderer over the existing analysis contract, not a second implementation of permission evaluation. Share data semantics and interaction state, but allow each surface to use appropriate rendering conventions.

### Existing implementation details

- `src/rpc.ts` defines typed graph, inventory, permission, and file-scope RPC methods. This is the natural contract to reuse or extend for another client.
- `docs/architecture.md` assigns normalization and permission analysis to the server, while the CLI plugin only renders results.
- M7 in `docs/milestone_plan.md` already specifies a browser-specific renderer via OpenCode's authenticated external-client path rather than unsupported browser embedding in the plugin.
- Mermaid export in `src/mermaid.ts` and `src/export.ts` is a snapshot/export feature, not a suitable substitute for a live web graph API.

## Activity overlay

### User-facing outcome

Users can tell the difference between an agent relationship that is permitted by configuration and a relationship that is currently active, waiting for approval, completed, failed, or interrupted. They can inspect the relevant sessions without mistaking activity for a permission decision.

### Recommendation and reasoning

Model runtime activity as a time-varying overlay over the static effective-permission topology:

- nodes show aggregate activity status and active-session count;
- edges show active delegation, approval waits, and latest observed outcome;
- focused activity exposes session identity, parent/child agent relationship, duration, and recent events;
- static configured capability remains visible independently of whether any session is currently active.

This separation is essential because a configured edge represents a possible attempted launch, not a guarantee that any launch occurred or succeeded. The terminal can use compact status/count markers, while the web graph can use animation and richer inspection.

### Existing implementation details

- The static graph contract in `src/domain.ts` contains configured `GraphEdge` decisions and constraints, but no runtime activity fields. Activity should be represented by a separate overlay contract rather than mutating decision semantics.
- `docs/milestone_plan.md` M9 specifies parent/child-session evidence, lifecycle states, event subscriptions, optional persisted history, and the caveats needed to avoid overclaiming runtime certainty.
- `docs/architecture.md` already states that static permission potential does not guarantee session launch, approval, or successful execution.

## Recommended delivery sequence

### User-facing outcome

Each release improves usability for real repositories while preserving stable semantics for future terminal and web capabilities.

### Recommendation and reasoning

Deliver the work in this order:

1. Make file scope directory-lazy, collapsible, cached, and navigable.
2. Establish the responsive selected-agent dashboard shell and stable panel-focus behavior.
3. Add tool scope using the generalized effective-permission evaluator.
4. Make an explicit product decision for instruction disclosure and source/provenance treatment.
5. Add comparison and aggregate-coverage scope views after the single-agent explorer is reliable.
6. Build the companion web graph over stabilized contracts.
7. Add runtime activity as a separate overlay.

This sequence addresses the current usability bottleneck first, avoids premature all-agent visualization complexity, and prevents web and terminal renderers from duplicating policy semantics.

### Existing implementation details

- M4–M9 in `docs/milestone_plan.md` already provide a compatible capability-scope, file-scope, tool-scope, web-viewer, provenance, and activity sequence.
- The current server-side analysis and typed RPC boundary support this sequencing, but the file-scope implementation must become lazy before it can safely serve large workspaces.
- `npm test` and `npm run typecheck` passed during the review that produced this document.
