import type { Screen } from "./model.ts"

export type Action =
  | "branch.first"
  | "branch.last"
  | "branch.next"
  | "branch.prev"
  | "branch.open"
  | "cursor.next"
  | "cursor.top"
  | "cursor.bottom"
  | "cursor.pageDown"
  | "cursor.pageUp"
  | "context.more"
  | "context.less"
  | "comment.next"
  | "comment.prev"
  | "hunk.next"
  | "hunk.prev"
  | "cursor.prev"
  | "file.next"
  | "file.prev"
  | "focus.toggle"
  | "nav.zoom"
  | "wrap.toggle"
  | "pan.right"
  | "pan.left"
  | "rail.toggle"
  | "review.reload"
  | "tree.collapse"
  | "tree.expand"
  | "file.vouch"
  | "file.vouch.next"
  | "select.start"
  | "select.hunk"
  | "select.swap"
  | "compose.open"
  | "compose.submit"
  | "compose.stage"
  | "pending.open"
  | "pending.submit"
  | "pending.edit"
  | "pending.drop"
  | "pending.next"
  | "pending.prev"
  | "compose.newline"
  | "palette.open"
  | "report.open"
  | "report.send"
  | "palette.run"
  | "back"
  | "quit"

export type Command = {
  readonly action: Action
  readonly title: string
  readonly category: string
  readonly keys: ReadonlyArray<string>
  readonly screens: ReadonlyArray<Screen>
  readonly hint: string
  readonly listed: boolean
  readonly whenStaged: boolean
  readonly whenLayers: boolean
}

const command = (input: Partial<Command> & Pick<Command, "action" | "title" | "keys" | "screens">): Command => ({
  category: "Review",
  hint: "",
  listed: true,
  whenStaged: false,
  whenLayers: false,
  ...input,
})

export const commands: ReadonlyArray<Command> = [
  command({
    action: "branch.next",
    title: "Next branch",
    category: "Branches",
    keys: ["down", "j"],
    screens: ["branches"],
    hint: "move",
  }),
  command({
    action: "branch.prev",
    title: "Previous branch",
    category: "Branches",
    keys: ["up", "k"],
    screens: ["branches"],
  }),
  command({
    action: "branch.open",
    title: "Open branch for review",
    category: "Branches",
    keys: ["return"],
    screens: ["branches"],
    hint: "review",
  }),
  command({
    action: "cursor.next",
    title: "Next line",
    keys: ["down", "j"],
    screens: ["review"],
    hint: "line",
  }),
  command({
    action: "cursor.prev",
    title: "Previous line",
    keys: ["up", "k"],
    screens: ["review"],
  }),
  command({
    action: "cursor.top",
    title: "Go to first line",
    keys: ["g"],
    screens: ["review"],
  }),
  command({
    action: "cursor.bottom",
    title: "Go to last line",
    keys: ["G"],
    screens: ["review"],
  }),
  command({
    action: "cursor.pageDown",
    title: "Half page down",
    keys: ["ctrl+d"],
    screens: ["review"],
  }),
  command({
    action: "cursor.pageUp",
    title: "Half page up",
    keys: ["ctrl+u"],
    screens: ["review"],
  }),
  command({
    action: "context.more",
    title: "Show more context",
    keys: ["+", "="],
    screens: ["review"],
  }),
  command({
    action: "context.less",
    title: "Show less context",
    keys: ["-", "_"],
    screens: ["review"],
  }),
  command({
    action: "comment.next",
    title: "Next comment",
    keys: ["n"],
    screens: ["review"],
    hint: "next comment",
    whenStaged: true,
  }),
  command({
    action: "comment.prev",
    title: "Previous comment",
    keys: ["N"],
    screens: ["review"],
  }),
  command({
    action: "hunk.next",
    title: "Next change",
    keys: ["}"],
    screens: ["review"],
  }),
  command({
    action: "hunk.prev",
    title: "Previous change",
    keys: ["{"],
    screens: ["review"],
  }),
  command({
    action: "file.next",
    title: "Next file",
    category: "Files",
    keys: ["]"],
    screens: ["review"],
    hint: "file",
  }),
  command({
    action: "file.prev",
    title: "Previous file",
    category: "Files",
    keys: ["["],
    screens: ["review"],
  }),
  command({
    action: "focus.toggle",
    title: "Switch pane",
    category: "General",
    keys: ["tab"],
    screens: ["review"],
  }),
  command({
    action: "nav.zoom",
    title: "Hide the file list",
    category: "General",
    keys: ["z", "\\"],
    screens: ["review"],
    hint: "zoom",
  }),
  command({
    action: "branch.first",
    title: "Go to the first worktree",
    category: "Branches",
    keys: ["g"],
    screens: ["branches"],
  }),
  command({
    action: "branch.last",
    title: "Go to the last worktree",
    category: "Branches",
    keys: ["G"],
    screens: ["branches"],
  }),
  command({
    action: "select.hunk",
    title: "Select the change under the cursor",
    keys: ["V"],
    screens: ["review"],
  }),
  command({
    action: "select.swap",
    title: "Grow the selection from its other end",
    keys: ["o"],
    screens: ["review"],
  }),
  command({
    action: "wrap.toggle",
    title: "Wrap long lines",
    category: "General",
    keys: ["w"],
    screens: ["review"],
    hint: "wrap",
  }),
  command({
    action: "pan.right",
    title: "Pan the diff right",
    keys: [">"],
    screens: ["review"],
  }),
  command({
    action: "pan.left",
    title: "Pan the diff left",
    keys: ["<"],
    screens: ["review"],
  }),
  command({
    action: "review.reload",
    title: "Read the branch again",
    category: "Review",
    keys: ["r"],
    screens: ["branches", "review"],
    hint: "reload",
  }),
  command({
    action: "rail.toggle",
    title: "Switch between layers and files",
    category: "Files",
    keys: ["s"],
    screens: ["review"],
    hint: "layers",
    whenLayers: true,
  }),
  command({
    action: "tree.collapse",
    title: "Close the folder, layer, or gap",
    category: "Files",
    keys: ["h"],
    screens: ["review"],
  }),
  command({
    action: "tree.expand",
    title: "Open the folder, layer, or gap",
    category: "Files",
    keys: ["l"],
    screens: ["review"],
  }),
  command({
    action: "file.vouch",
    title: "Mark reviewed",
    category: "Files",
    keys: ["m"],
    screens: ["review"],
    hint: "reviewed",
  }),
  command({
    action: "file.vouch.next",
    title: "Mark reviewed and go to next",
    category: "Files",
    keys: ["M"],
    screens: ["review"],
  }),
  command({
    action: "select.start",
    title: "Start a selection",
    keys: ["v"],
    screens: ["review"],
    hint: "select",
  }),
  command({
    action: "compose.open",
    title: "Comment on the selection",
    keys: ["c", "return"],
    screens: ["review"],
    hint: "comment",
  }),
  command({
    action: "report.open",
    title: "Report a bug",
    category: "General",
    keys: ["ctrl+b"],
    screens: ["branches", "review"],
  }),
  command({
    action: "report.send",
    title: "Send the report",
    keys: ["ctrl+s"],
    screens: ["report"],
    hint: "copy",
    listed: false,
  }),
  command({
    action: "palette.open",
    title: "Find a command",
    category: "General",
    keys: ["ctrl+p"],
    screens: ["review"],
    hint: "commands",
    listed: false,
  }),
  command({
    action: "compose.submit",
    title: "Send the comment",
    keys: ["ctrl+s"],
    screens: ["compose"],
    hint: "send",
    listed: false,
  }),
  command({
    action: "pending.open",
    title: "Review what is staged",
    keys: ["S"],
    screens: ["review"],
    hint: "review",
    whenStaged: true,
  }),
  command({
    action: "pending.submit",
    title: "Send the review",
    keys: ["ctrl+s"],
    screens: ["pending"],
    hint: "send",
    listed: false,
  }),
  command({
    action: "pending.edit",
    title: "Reword this comment",
    category: "Review",
    keys: ["e"],
    screens: ["pending"],
    hint: "reword",
  }),
  command({
    action: "pending.drop",
    title: "Withdraw this comment",
    category: "Review",
    keys: ["X"],
    screens: ["pending"],
    hint: "withdraw",
  }),
  command({
    action: "pending.next",
    title: "Next staged comment",
    keys: ["down", "j"],
    screens: ["pending"],
    listed: false,
  }),
  command({
    action: "pending.prev",
    title: "Previous staged comment",
    keys: ["up", "k"],
    screens: ["pending"],
    listed: false,
  }),
  command({
    action: "compose.stage",
    title: "Add to review",
    keys: ["ctrl+a"],
    screens: ["compose"],
    hint: "stage",
    listed: false,
  }),
  command({
    action: "compose.newline",
    title: "New line",
    keys: ["return"],
    screens: ["compose"],
    listed: false,
  }),
  command({
    action: "palette.run",
    title: "Run the highlighted command",
    keys: ["return"],
    screens: ["palette"],
    hint: "run",
    listed: false,
  }),
  command({
    action: "back",
    title: "Go back",
    category: "General",
    keys: ["escape", "q"],
    screens: ["review", "compose", "palette", "pending", "report"],
    hint: "back",
    listed: false,
  }),
  command({
    action: "quit",
    title: "Quit",
    category: "General",
    keys: ["q"],
    screens: ["branches"],
    hint: "quit",
    listed: false,
  }),
]

const TEXT_SCREENS: ReadonlySet<Screen> = new Set<Screen>(["compose", "palette", "report"])

const PRINTABLE_KEY = /^[\S ]$/

export const takesText = (screen: Screen): boolean => TEXT_SCREENS.has(screen)

export const commandsFor = (screen: Screen): ReadonlyArray<Command> =>
  commands.filter((entry) => entry.screens.includes(screen))

export const listableFor = (screen: Screen): ReadonlyArray<Command> =>
  commandsFor(screen).filter((entry) => entry.listed)

export const actionFor = (screen: Screen, key: string): Action | undefined => {
  if (takesText(screen) && PRINTABLE_KEY.test(key)) return undefined
  return commandsFor(screen).find((entry) => entry.keys.includes(key))?.action
}

export const keyFor = (screen: Screen, action: Action): string =>
  commandsFor(screen).find((entry) => entry.action === action)?.keys[0] ?? ""

const GLYPHS: Readonly<Record<string, string>> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  return: "↵",
  escape: "esc",
  space: "␣",
  backspace: "⌫",
}

export const displayKey = (key: string): string => {
  if (key.startsWith("ctrl+")) return `^${key.slice(5)}`
  return GLYPHS[key] ?? key
}

export const hintsFor = (
  screen: Screen,
  staged: number,
  layers = 0,
): ReadonlyArray<{ key: string; hint: string; press: string }> =>
  commandsFor(screen)
    .filter((entry) => entry.hint.length > 0)
    .filter((entry) => !entry.whenStaged || staged > 0)
    .filter((entry) => !entry.whenLayers || layers > 0)
    .map((entry) => ({ key: displayKey(entry.keys[0] ?? ""), hint: entry.hint, press: entry.keys[0] ?? "" }))
