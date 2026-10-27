import { Rpc } from "@opencode/plugin/rpc"

export const ArgChartRPC = Rpc.define({
  id: "argchart",
  methods: {
    "inventory.refresh": {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          view: { const: "effective-runtime" },
          refreshedAt: { type: "string", format: "date-time" },
          nodes: {
            type: "array",
            items: {
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
                raw: { type: "object", additionalProperties: true },
              },
              required: ["id", "name", "mode", "hidden", "raw"],
              additionalProperties: false,
            },
          },
        },
        required: ["view", "refreshedAt", "nodes"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})
