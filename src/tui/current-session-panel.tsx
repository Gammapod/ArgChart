import { usePlugin } from "@opencode/plugin/tui"
import { Show } from "solid-js"
import type { SessionPreviewTurn } from "../session-preview.js"

/** Ephemeral prompt/response preview for the selected agent's current or recent session. */
export function CurrentSessionPanel(props: {
  promptSender: string
  responseSender: string
  sessionTitle?: string
  sessionID?: string
  turn?: SessionPreviewTurn
}) {
  const context = usePlugin()
  return (
    <scrollbox contentOptions={{ flexDirection: "column" }} width="35%" height="100%" borderStyle="single" borderColor={context.theme.border.base} padding={1}>
      <text fg={context.theme.text.muted}>CURRENT SESSION</text>
      <text fg={context.theme.text.base}>{props.promptSender} : {props.responseSender} - {props.sessionTitle ?? "Untitled session"}</text>
      <Show when={props.sessionID} fallback={<text fg={context.theme.text.muted}>No recent session for this agent.</text>}>
        <Show when={props.turn} fallback={<text fg={context.theme.text.muted}>Loading the latest prompt…</text>}>
          {(turn) => <>
            <box justifyContent="flex-end"><text fg={context.theme.text.muted}>{props.promptSender}</text></box>
            <box justifyContent="flex-end"><box width="90%"><text>{turn().prompt}</text></box></box>
            <box marginTop={1}><text fg={context.theme.text.muted}>{props.responseSender}</text></box>
            <Show when={turn().response} fallback={<text fg={context.theme.text.muted}>Waiting for response…</text>}>
              {(response) => <box width="90%"><text>{response()}</text></box>}
            </Show>
          </>}
        </Show>
      </Show>
    </scrollbox>
  )
}
