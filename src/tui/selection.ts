import type { AgentID, CommunicationGraph } from "../domain.js"

export interface FocusedRelationship {
  source: AgentID
  target: AgentID
}

export interface SelectionState {
  focusedAgentID?: AgentID
  selectedAgentIDs: readonly AgentID[]
  focusedRelationship?: FocusedRelationship
}

export const emptySelection: SelectionState = { selectedAgentIDs: [] }

export function focusAgent(selection: SelectionState, agentID: AgentID | undefined): SelectionState {
  const { focusedAgentID: _focusedAgentID, ...withoutFocus } = selection
  return {
    ...withoutFocus,
    selectedAgentIDs: agentID === undefined ? selection.selectedAgentIDs : [agentID],
    ...(agentID === undefined ? {} : { focusedAgentID: agentID }),
  }
}

export function moveFocusedAgent(graph: CommunicationGraph, selection: SelectionState, offset: number): SelectionState {
  if (!graph.nodes.length) return emptySelection
  const current = graph.nodes.findIndex((node) => node.id === selection.focusedAgentID)
  if (current === -1) return focusAgent(selection, graph.nodes[offset < 0 ? graph.nodes.length - 1 : 0].id)
  const index = (current + offset + graph.nodes.length) % graph.nodes.length
  return focusAgent(selection, graph.nodes[index].id)
}

export function reconcileSelection(graph: CommunicationGraph, selection: SelectionState): SelectionState {
  const agentIDs = new Set(graph.nodes.map((node) => node.id))
  const selectedAgentIDs = selection.selectedAgentIDs.filter((id) => agentIDs.has(id))
  const focusedAgentID = selection.focusedAgentID && agentIDs.has(selection.focusedAgentID)
    ? selection.focusedAgentID
    : selectedAgentIDs[0]
  const focusedRelationship = selection.focusedRelationship
    && graph.edges.some((edge) => edge.source === selection.focusedRelationship!.source && edge.target === selection.focusedRelationship!.target)
    ? selection.focusedRelationship
    : undefined

  return {
    selectedAgentIDs: focusedAgentID && !selectedAgentIDs.includes(focusedAgentID)
      ? [focusedAgentID, ...selectedAgentIDs]
      : selectedAgentIDs,
    ...(focusedAgentID === undefined ? {} : { focusedAgentID }),
    ...(focusedRelationship === undefined ? {} : { focusedRelationship }),
  }
}
