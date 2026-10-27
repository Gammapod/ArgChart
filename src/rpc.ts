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
