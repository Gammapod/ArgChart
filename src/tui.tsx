import { Plugin } from "@opencode/plugin/tui"
import type { AgentInventory, CommunicationGraph } from "./domain.js"
import { ArgChartRPC } from "./rpc.js"
import { ArgChartViewer } from "./viewer.js"
import { defaultTopologyFilters } from "./topology.js"

export default Plugin.define({
  id: "argchart.tui",
  setup(context) {
    const inventory = context.client.rpc(ArgChartRPC)
    const [topologyFilters, updateTopologyFilters] = context.storage.memory("topology-filters", { initial: defaultTopologyFilters })
    const [, updateViewerOptions] = context.storage.memory("viewer-options", { initial: { showDetails: true } })
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
          id: "argchart.export-mermaid",
          title: "Export ArgChart Mermaid graph",
          group: "ArgChart",
          palette: true,
          run: async () => {
            const result = (await inventory["graph.export-mermaid"]({ ...topologyFilters }, { location: context.location })) as { outputPath: string }
            context.ui.toast.show({ message: `Mermaid graph exported to ${result.outputPath}`, variant: "success" })
          },
        },
        {
          id: "argchart.toggle-subagents",
          title: "Toggle ArgChart subagent nodes",
          group: "ArgChart filters",
          palette: true,
          run: () => updateTopologyFilters((filters) => { filters.showSubagents = !filters.showSubagents }),
        },
        {
          id: "argchart.toggle-ask-edges",
          title: "Toggle ArgChart ask edges",
          group: "ArgChart filters",
          palette: true,
          run: () => updateTopologyFilters((filters) => { filters.showAskEdges = !filters.showAskEdges }),
        },
        {
          id: "argchart.toggle-deny-edges",
          title: "Toggle ArgChart denied edges",
          group: "ArgChart filters",
          palette: true,
          run: () => updateTopologyFilters((filters) => { filters.showDenyEdges = !filters.showDenyEdges }),
        },
        {
          id: "argchart.toggle-details",
          title: "Toggle ArgChart details panel",
          group: "ArgChart",
          palette: true,
          run: () => updateViewerOptions((options) => { options.showDetails = !options.showDetails }),
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
