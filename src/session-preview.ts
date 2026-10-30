import type { SessionMessageInfo } from "@opencode/client"

export interface SessionPreviewTurn {
  prompt: string
  response?: string
}

/** The newest user prompt and latest assistant text message that follows it. */
export function latestSessionPreviewTurn(messages: readonly SessionMessageInfo[]): SessionPreviewTurn | undefined {
  const prompt = [...messages]
    .filter((message) => message.type === "user")
    .sort((left, right) => right.time.created - left.time.created)[0]
  if (!prompt || prompt.type !== "user") return undefined

  const response = [...messages]
    .filter((message) => message.type === "assistant" && message.time.created >= prompt.time.created && message.content.some((part) => part.type === "text"))
    .sort((left, right) => right.time.created - left.time.created)[0]
  return {
    prompt: prompt.text,
    ...(response?.type !== "assistant" ? {} : {
      response: response.content.filter((part) => part.type === "text").map((part) => part.text).join("\n"),
    }),
  }
}
