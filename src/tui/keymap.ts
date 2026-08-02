export type Action =
  | "branch.next"
  | "branch.prev"
  | "branch.open"
  | "cursor.next"
  | "cursor.prev"
  | "file.next"
  | "file.prev"
  | "select.start"
  | "compose.open"
  | "compose.submit"
  | "back"
  | "quit"

export type Binding = {
  readonly keys: ReadonlyArray<string>
  readonly action: Action
  readonly hint: string
}

export const branchBindings: ReadonlyArray<Binding> = [
  { keys: ["down", "j"], action: "branch.next", hint: "move" },
  { keys: ["up", "k"], action: "branch.prev", hint: "" },
  { keys: ["return"], action: "branch.open", hint: "review" },
  { keys: ["q"], action: "quit", hint: "quit" },
]

export const reviewBindings: ReadonlyArray<Binding> = [
  { keys: ["down", "j"], action: "cursor.next", hint: "line" },
  { keys: ["up", "k"], action: "cursor.prev", hint: "" },
  { keys: ["]"], action: "file.next", hint: "file" },
  { keys: ["["], action: "file.prev", hint: "" },
  { keys: ["v"], action: "select.start", hint: "select" },
  { keys: ["c", "return"], action: "compose.open", hint: "comment" },
  { keys: ["escape"], action: "back", hint: "branches" },
  { keys: ["q"], action: "quit", hint: "quit" },
]

export const composeBindings: ReadonlyArray<Binding> = [
  { keys: ["ctrl+s"], action: "compose.submit", hint: "send" },
  { keys: ["escape"], action: "back", hint: "discard" },
]

export const bindingsFor = (screen: string): ReadonlyArray<Binding> => {
  if (screen === "branches") return branchBindings
  if (screen === "compose") return composeBindings
  return reviewBindings
}

export const actionFor = (screen: string, key: string): Action | undefined =>
  bindingsFor(screen).find((binding) => binding.keys.includes(key))?.action
