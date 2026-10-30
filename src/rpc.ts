import { Rpc } from "@opencode/plugin/rpc"

const permissionRuleSchema = {
  type: "object",
  properties: {
    action: { type: "string" },
    resource: { type: "string" },
    effect: { enum: ["allow", "ask", "deny"] },
  },
  required: ["action", "resource", "effect"],
  additionalProperties: false,
} as const

const matchedPermissionRuleSchema = {
  type: "object",
  properties: { ...permissionRuleSchema.properties, index: { type: "number" } },
  required: ["action", "resource", "effect", "index"],
  additionalProperties: false,
} as const

const permissionDecisionSchema = {
  type: "object",
  properties: {
    action: { type: "string" },
    resource: { type: "string" },
    decision: { enum: ["allow", "ask", "deny"] },
    matchingRule: matchedPermissionRuleSchema,
    matchingRules: { type: "array", items: matchedPermissionRuleSchema },
    summary: { type: "string" },
  },
  required: ["action", "resource", "decision", "matchingRules", "summary"],
  additionalProperties: false,
} as const

const nodeSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    mode: { enum: ["primary", "subagent", "all"] },
    model: {
      type: "object",
      properties: {
        providerID: { type: "string" },
        id: { type: "string" },
        variant: { type: "string" },
      },
      required: ["providerID", "id"],
      additionalProperties: false,
    },
    hidden: { type: "boolean" },
    permissions: { type: "array", items: permissionRuleSchema },
  },
  required: ["id", "name", "mode", "hidden", "permissions"],
  additionalProperties: false,
} as const

const inventorySchema = {
  type: "object",
  properties: {
    view: { const: "effective-runtime" },
    refreshedAt: { type: "string", format: "date-time" },
    nodes: { type: "array", items: nodeSchema },
  },
  required: ["view", "refreshedAt", "nodes"],
  additionalProperties: false,
} as const

const activitySnapshotSchema = {
  type: "object",
  properties: {
    view: { const: "runtime-api" },
    generatedAt: { type: "string", format: "date-time" },
    sessions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" }, parentID: { type: "string" }, agentID: { type: "string" }, title: { type: "string" },
          createdAt: { type: "number" }, updatedAt: { type: "number" }, outcome: { enum: ["succeeded", "failed", "interrupted"] },
        },
        required: ["id", "createdAt", "updatedAt"],
        additionalProperties: false,
      },
    },
    observedChildSessions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          parentSessionID: { type: "string" }, childSessionID: { type: "string" }, sourceAgentID: { type: "string" }, targetAgentID: { type: "string" },
        },
        required: ["parentSessionID", "childSessionID", "sourceAgentID", "targetAgentID"],
        additionalProperties: false,
      },
    },
  },
  required: ["view", "generatedAt", "sessions", "observedChildSessions"],
  additionalProperties: false,
} as const

const graphSchema = {
  type: "object",
  properties: {
    view: { const: "effective-runtime" },
    generatedAt: { type: "string", format: "date-time" },
    nodes: { type: "array", items: nodeSchema },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          decision: { enum: ["allow", "ask", "deny"] },
          wildcardDerived: { type: "boolean" },
          explanation: {
            type: "object",
            properties: {
              decision: { enum: ["allow", "ask", "deny"] },
              summary: { type: "string" },
              matchingRule: {
                type: "object",
                properties: { ...permissionRuleSchema.properties, index: { type: "number" } },
                required: ["action", "resource", "effect", "index"],
                additionalProperties: false,
              },
            },
            required: ["decision", "summary"],
            additionalProperties: false,
          },
          constraints: { type: "array", items: { type: "object", properties: {}, additionalProperties: false } },
        },
        required: ["source", "target", "decision", "wildcardDerived", "explanation", "constraints"],
        additionalProperties: false,
      },
    },
    constraints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { enum: ["target-mode", "runtime-depth"] },
          summary: { type: "string" },
          target: { type: "string" },
        },
        required: ["type", "summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["view", "generatedAt", "nodes", "edges", "constraints"],
  additionalProperties: false,
} as const

export const ArgChartRPC = Rpc.define({
  id: "argchart",
  methods: {
    "inventory.refresh": {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: inventorySchema,
    },
    "graph.refresh": {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: graphSchema,
    },
    "activity.refresh": {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: activitySnapshotSchema,
    },
    "permission.evaluate": {
      input: {
        type: "object",
        properties: { agentID: { type: "string" }, action: { type: "string" }, resource: { type: "string" } },
        required: ["agentID", "action", "resource"],
        additionalProperties: false,
      },
      output: permissionDecisionSchema,
    },
    "file-scope.list": {
      input: {
        type: "object",
        properties: { agentID: { type: "string" }, path: { type: "string" } },
        required: ["agentID", "path"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          view: { const: "effective-runtime" },
          agentID: { type: "string" },
          path: { type: "string" },
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" }, name: { type: "string" }, kind: { enum: ["file", "directory", "pattern"] },
                exists: { type: "boolean" }, read: permissionDecisionSchema, edit: permissionDecisionSchema,
                readHasNestedException: { type: "boolean" }, editHasNestedException: { type: "boolean" },
              },
                required: ["path", "name", "kind", "exists", "read", "edit", "readHasNestedException", "editHasNestedException"],
              additionalProperties: false,
            },
          },
        },
        required: ["view", "agentID", "path", "entries"],
        additionalProperties: false,
      },
    },
    "graph.export-mermaid": {
      input: {
        type: "object",
        properties: {
          showSubagents: { type: "boolean" },
          showAskEdges: { type: "boolean" },
          showDenyEdges: { type: "boolean" },
          overwrite: { type: "boolean" },
        },
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { outputPath: { type: "string" }, status: { enum: ["written", "exists"] } },
        required: ["outputPath", "status"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})
