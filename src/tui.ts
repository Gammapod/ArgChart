import { Plugin } from "@opencode/plugin/tui"

export default Plugin.define({
  id: "argchart.tui",
  setup(context) {
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
      ],
    }))
  },
})
