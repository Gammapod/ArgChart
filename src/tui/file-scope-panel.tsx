import { usePlugin } from "@opencode/plugin/tui"
import { For } from "solid-js"
import type { EdgeDecision, FileScopeDirectory, FileScopeEntry } from "../domain.js"

const symbol: Record<EdgeDecision, string> = { allow: "✓", ask: "?", deny: "×" }

export function FileScopePanel(props: { scope: FileScopeDirectory; entries: readonly FileScopeEntry[] }) {
  const context = usePlugin()
  return (
    <box flexDirection="column" height="100%" flexGrow={1} overflow="scroll" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.base}>FILE SCOPE · {props.scope.agentID} · /{props.scope.path || ""}</text>
      <box flexDirection="row">
        <text width={42} fg={context.theme.text.muted}>NAME</text>
        <text width={8} fg={context.theme.text.muted}>READ</text>
        <text width={8} fg={context.theme.text.muted}>EDIT</text>
      </box>
      <For each={props.entries} fallback={<text fg={context.theme.text.muted}>No accessible or approval-required entries.</text>}>
        {(entry) => <FileScopeRow entry={entry} />}
      </For>
    </box>
  )
}

function FileScopeRow(props: { entry: FileScopeEntry }) {
  const context = usePlugin()
  const nameColor = () => props.entry.exists ? context.theme.text.base : context.theme.text.feedback.info.base
  const name = () => `${"  ".repeat(props.entry.depth)}${props.entry.kind === "directory" ? "▸ " : "  "}${props.entry.name}`
  return (
    <box flexDirection="row">
      <text width={42} fg={nameColor()}>  {name()}</text>
      <Decision decision={props.entry.read.decision} />
      <Decision decision={props.entry.edit.decision} />
    </box>
  )
}

function Decision(props: { decision: EdgeDecision }) {
  const context = usePlugin()
  const color = props.decision === "allow" ? context.theme.text.feedback.success.base
    : props.decision === "ask" ? context.theme.text.feedback.warning.base
      : context.theme.text.feedback.error.base
  return <text width={8} fg={color}>{symbol[props.decision]} {props.decision}</text>
}
