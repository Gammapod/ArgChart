import { Plugin } from "@opencode/plugin/tui"
import type { AgentInventory } from "./domain.js"
import { ArgChartRPC } from "./rpc.js"

export default Plugin.define({
  id: "argchart.tui",
  setup(context) {
    const inventory = context.client.rpc(ArgChartRPC)

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "argchart.open",
          title: "Open ArgChart",
          group: "ArgChart",
          palette: true,
          run: () => context.ui.toast.show({ message: "ArgChart is loaded" }),
        },
        {
          id: "argchart.refresh-inventory",
          title: "Refresh ArgChart agent inventory",
          group: "ArgChart",
          palette: true,
          run: async () => {
            const result = (await inventory["inventory.refresh"]({}, { location: context.location })) as AgentInventory
            context.ui.toast.show({
              message: `Effective runtime inventory: ${result.nodes.length} agents`,
              variant: "success",
            })
          },
        },
      ],
    }))
  },
})
