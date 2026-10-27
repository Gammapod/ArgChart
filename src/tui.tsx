import { Plugin } from "@opencode/plugin/tui"
import type { AgentInventory, CommunicationGraph } from "./domain.js"
import { ArgChartRPC } from "./rpc.js"
import { ArgChartViewer } from "./viewer.js"

export default Plugin.define({
  id: "argchart.tui",
  setup(context) {
    const inventory = context.client.rpc(ArgChartRPC)
    const unregisterRoute = context.ui.router.register({
      name: "argchart",
      render: () => <ArgChartViewer />,
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "argchart.open",
          title: "Open ArgChart",
          group: "ArgChart",
          palette: true,
          run: () => context.ui.router.navigate({ type: "plugin", name: "argchart" }),
        },
        {
          id: "argchart.refresh-graph",
          title: "Refresh ArgChart communication graph",
          group: "ArgChart",
          palette: true,
          run: async () => {
            const result = (await inventory["graph.refresh"]({}, { location: context.location })) as CommunicationGraph
            const decisions = result.edges.reduce(
              (counts, edge) => ({ ...counts, [edge.decision]: counts[edge.decision] + 1 }),
              { allow: 0, ask: 0, deny: 0 },
            )
            context.ui.toast.show({
              message: `Communication graph: ${result.edges.length} edges (${decisions.allow} allow, ${decisions.ask} ask, ${decisions.deny} deny)`,
              variant: "success",
            })
          },
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

    return unregisterRoute
  },
})
