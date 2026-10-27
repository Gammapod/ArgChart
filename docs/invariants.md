---
type: Test specification
title: ArgChart functional invariants
description: Functional invariants for ArgChart's effective-runtime analysis, topology projections, selection state, and Mermaid export, with test traceability.
tags: [testing, invariants, permissions, topology]
status: active
---

# ArgChart functional invariants

## Scope

These invariants define ArgChart's behavior over OpenCode's runtime-resolved agent registry and effective ordered permission rules. They do not claim to execute OpenCode's session-bound permission engine: ArgChart performs a read-only, prospective evaluation of the effective rules.

Run the suite with:

```sh
npm test
```

## Inventory invariants

| ID | Invariant | Evidence |
| --- | --- | --- |
| INV-1 | A runtime agent is normalized to the graph fields required for analysis and rendering. | `test/inventory.test.ts` — `inventory normalization retains graph fields...` |
| INV-2 | Unrestricted raw runtime payloads are not exposed through normalized graph nodes. | `test/inventory.test.ts` — `inventory normalization retains graph fields...` |

## Permission invariants

| ID | Invariant | Evidence |
| --- | --- | --- |
| PERM-1 | The last matching effective `subagent` rule determines the decision. | `test/permission.test.ts` — targeted allow/deny override tests |
| PERM-2 | Whole-value `*` and `?` matching follows the documented permission semantics. | `test/permission.test.ts` — wildcard/default test |
| PERM-3 | No matching effective rule produces `ask`. | `test/permission.test.ts` — wildcard/default test |

## Communication graph invariants

| ID | Invariant | Evidence |
| --- | --- | --- |
| GRAPH-1 | Only `subagent` and `all` agents are callable graph targets. | `test/communication-graph.test.ts` — primary-only target test |
| GRAPH-2 | Primary-only target exclusion is recorded as a target-mode constraint, not rendered as a callable edge. | `test/communication-graph.test.ts` — primary-only target test |
| GRAPH-3 | Every graph decision is configured effective permission potential, not a promise that a session launch will succeed. | Architecture decision; manual smoke test only — not unit-testable without invoking session behavior |

## Topology invariants

| ID | Invariant | Evidence |
| --- | --- | --- |
| TOPO-1 | Virtual User edges exist for `primary` and `all` agents, never subagent-only agents. | `test/topology.test.ts` — User-edge test |
| TOPO-2 | Filters remove excluded nodes and every incident edge. | `test/topology.test.ts` — default-filter test |
| TOPO-3 | Default topology hides subagent-only nodes and deny edges. | `test/topology.test.ts` — default-filter test |
| TOPO-4 | A local-layout neighbor appears once: inbound-only left; outbound-only or two-way right; User first inbound. | `test/topology.test.ts` — local-layout test |
| TOPO-5 | Two-way relationships retain independent decisions for each direction. | `test/topology.test.ts` — local-layout test |

## Selection and export invariants

| ID | Invariant | Evidence |
| --- | --- | --- |
| SELECT-1 | The selection model permits no focused agent. | `test/selection.test.ts` — no-focus test |
| SELECT-2 | Focus movement is cyclic and refresh reconciliation removes invalid focus. | `test/selection.test.ts` — movement/reconciliation test |
| EXPORT-1 | Mermaid output contains the virtual User node and retains requested decision labels. | `test/mermaid.test.ts` — Mermaid-content test |
| EXPORT-2 | An existing Mermaid file is not overwritten unless explicitly requested. | `test/mermaid.test.ts` — explicit-overwrite test |

## Boundaries and future tests

- Live OpenCode policy enforcement, session approvals, depth limits, and launch outcomes require integration tests against real sessions; they are intentionally outside the current read-only unit suite.
- M4 should add source-discovery, parsing, provenance, ambiguity, and non-destructive inspection invariants before source editing is considered.
- A future renderer should test its own navigation and focus behavior against the shared selection and topology invariants rather than duplicating permission tests.
