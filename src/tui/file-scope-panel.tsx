import { usePlugin } from "@opencode/plugin/tui"
import { createEffect, For, Show } from "solid-js"
import type { EdgeDecision, FileScopeDirectory } from "../domain.js"
import type { FileScopeTreeEntry } from "./file-scope-tree.js"

const symbol: Record<EdgeDecision, string> = { allow: "✓", ask: "?", deny: "×" }

export function FileScopePanel(props: {
  scope: FileScopeDirectory
  entries: readonly FileScopeTreeEntry[]
  focused: boolean
  focusedIndex: number
}) {
  const context = usePlugin()
  let scrollbox: { scrollChildIntoView(childID: string): void } | undefined
  createEffect(() => {
    if (props.focused) scrollbox?.scrollChildIntoView(`argchart-file-scope-row-${props.focusedIndex}`)
  })
  return (
    <scrollbox ref={(value) => { scrollbox = value }} contentOptions={{ flexDirection: "column" }} height="100%" flexGrow={1} borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={props.focused ? context.theme.text.action.primary.base : context.theme.text.base}>FILE SCOPE · {props.scope.agentID} · /{props.scope.path || ""}</text>
      <box flexDirection="row">
        <text fg={context.theme.text.muted}>f focus · j/k select · enter toggle · x exceptions · c collapse · * nested exception</text>
      </box>
      <box flexDirection="row">
        <text width={42} fg={context.theme.text.muted}>NAME</text>
        <text width={8} fg={context.theme.text.muted}>READ</text>
        <text width={8} fg={context.theme.text.muted}>EDIT</text>
      </box>
      <For each={props.entries} fallback={<text fg={context.theme.text.muted}>No accessible or approval-required entries.</text>}>
        {(treeEntry, index) => <FileScopeRow treeEntry={treeEntry} index={index()} selected={props.focused && index() === props.focusedIndex} />}
      </For>
    </scrollbox>
  )
}

function FileScopeRow(props: { treeEntry: FileScopeTreeEntry; index: number; selected: boolean }) {
  const context = usePlugin()
  const entry = () => props.treeEntry.entry
  const nameColor = () => entry().exists ? context.theme.text.base : context.theme.text.feedback.info.base
  const folderSymbol = () => props.treeEntry.loading ? "⋯ " : props.treeEntry.expanded ? "▼ " : "▶ "
  const name = () => `${"  ".repeat(props.treeEntry.depth)}${entry().kind === "directory" ? folderSymbol() : "  "}${entry().name}`
  return (
    <box id={`argchart-file-scope-row-${props.index}`} flexDirection="row">
      <text width={42} fg={props.selected ? context.theme.text.action.primary.base : nameColor()}>{props.selected ? "› " : "  "}{name()}</text>
      <Decision decision={entry().read.decision} hasNestedException={entry().readHasNestedException} />
      <Decision decision={entry().edit.decision} hasNestedException={entry().editHasNestedException} />
    </box>
  )
}

function Decision(props: { decision: EdgeDecision; hasNestedException: boolean }) {
  const context = usePlugin()
  const color = props.decision === "allow" ? context.theme.text.feedback.success.base
    : props.decision === "ask" ? context.theme.text.feedback.warning.base
      : context.theme.text.feedback.error.base
  return <box width={8} flexDirection="row">
    <text fg={color}>{symbol[props.decision]} {props.decision}</text>
    <Show when={props.hasNestedException}><text fg={context.theme.text.feedback.info.base}>*</text></Show>
  </box>
}
