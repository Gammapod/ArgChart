import type { AgentInfo, AgentListOutput } from "@opencode/client"
import type { AgentInventory, AgentModel, AgentRuntimeData, GraphNode, PermissionRule } from "./domain.js"

export interface AgentRegistry {
  list(): Promise<AgentListOutput>
}

export class AgentInventoryService {
  constructor(private readonly agents: AgentRegistry) {}

  async refresh(): Promise<AgentInventory> {
    const response = await this.agents.list()

    return {
      view: "effective-runtime",
      refreshedAt: new Date().toISOString(),
      nodes: response.data.map(normalizeAgent),
    }
  }
}

function normalizeAgent(agent: AgentInfo): GraphNode {
  const model = normalizeModel(agent.model)

  return {
    id: agent.id,
    name: agent.name,
    mode: agent.mode,
    hidden: agent.hidden,
    permissions: agent.permissions.map(normalizePermissionRule),
    raw: JSON.parse(JSON.stringify(agent)) as AgentRuntimeData,
    ...(agent.description === undefined ? {} : { description: agent.description }),
    ...(model === undefined ? {} : { model }),
  }
}

function normalizePermissionRule(rule: AgentInfo["permissions"][number]): PermissionRule {
  return {
    action: rule.action,
    resource: rule.resource,
    effect: rule.effect,
  }
}

function normalizeModel(model: AgentInfo["model"]): AgentModel | undefined {
  if (!model) return undefined

  return {
    providerID: model.providerID,
    id: model.id,
    ...(model.variant === undefined ? {} : { variant: model.variant }),
  }
}
