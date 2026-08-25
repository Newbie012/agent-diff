import type { Screen } from "./model.ts"

export type Action =
  | "branch.first"
  | "branch.last"
  | "branch.next"
  | "branch.prev"
  | "branch.open"
  | "branch.pull"
  | "cursor.next"
  | "cursor.top"
  | "cursor.bottom"
  | "cursor.pageDown"
  | "cursor.pageUp"
  | "context.more"
  | "context.less"
  | "context.whole"
  | "comment.next"
  | "comment.prev"
  | "hunk.next"
  | "hunk.prev"
  | "cursor.prev"
  | "file.next"
  | "file.prev"
  | "focus.toggle"
  | "focus.back"
  | "panel.toggle"
  | "nav.zoom"
  | "wrap.toggle"
  | "sticky.toggle"
  | "pan.right"
  | "pan.left"
  | "layers.ask"
  | "nav.toggle"
  | "rail.toggle"
  | "tree.winnow"
  | "panel.winnow"
  | "thread.reply"
  | "remark.accept"
  | "panel.flip"
  | "review.reload"
  | "base.open"
  | "base.set"
  | "base.clear"
  | "base.next"
  | "base.prev"
  | "thread.settle"
  | "thread.settleRead"
  | "thread.remove"
  | "tree.collapse"
  | "tree.expand"
  | "file.vouch"
  | "file.vouch.next"
  | "search.open"
  | "search.jump"
  | "match.next"
  | "match.prev"
  | "selection.copy"
  | "select.start"
  | "select.grow"
  | "select.shrink"
  | "select.hunk"
  | "select.swap"
  | "compose.open"
  | "compose.submit"
  | "palette.open"
  | "held.send"
  | "settings.open"
  | "settings.next"
  | "settings.prev"
  | "settings.flip"
  | "keys.open"
  | "keys.next"
  | "keys.prev"
  | "report.open"
  | "report.mode"
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
  readonly also: ReadonlyArray<string>
  readonly listed: boolean
  readonly whenComments: boolean
  readonly counted: boolean
  readonly whenLayers: boolean
  readonly whenStale: boolean
  readonly whenThread: boolean
  readonly whenRemark: boolean
  readonly whenAnswerable: boolean
  readonly whenSelecting: boolean
  readonly whenReviewed: boolean
  readonly whenPull: boolean
  readonly whenHeld: boolean
  readonly panes: ReadonlyArray<Pane>
  readonly rank: number
}

export type Pane = "tree" | "diff" | "review"

const EVERY_PANE: ReadonlyArray<Pane> = ["tree", "diff", "review"]

export type Offered = {
  readonly comments: number
  readonly held: number
  readonly layers: number
  readonly onThread: boolean
  readonly selecting: boolean
  readonly reviewed: number
  readonly pull: boolean
  readonly stale: boolean
  readonly pane: Pane
  readonly onLayers: boolean
  readonly hidingRead: boolean
  readonly hidingSettled: boolean
  readonly onRemoved: boolean
  readonly onHeld: boolean
  readonly onRemark: boolean
  readonly onDismissed: boolean
}

const command = (input: Partial<Command> & Pick<Command, "action" | "title" | "keys" | "screens">): Command => ({
  category: "Reading",
  hint: "",
  also: [],
  listed: true,
  whenComments: false,
  counted: false,
  whenLayers: false,
  whenStale: false,
  whenThread: false,
  whenRemark: false,
  whenAnswerable: false,
  whenSelecting: false,
  whenReviewed: false,
  whenPull: false,
  whenHeld: false,
  panes: EVERY_PANE,
  rank: 0,
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
    rank: 1,
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
    rank: 2,
  }),
  command({
    action: "branch.pull",
    title: "Open the pull request in a browser",
    category: "Branches",
    keys: ["p"],
    screens: ["branches"],
    hint: "pull request",
    whenPull: true,
    rank: 4,
  }),
  command({
    action: "branch.pull",
    title: "Open the pull request in a browser",
    category: "Branches",
    keys: ["p"],
    screens: ["review"],
    hint: "pull request",
    whenPull: true,
    rank: 5,
  }),
  command({
    action: "cursor.next",
    category: "Moving",
    title: "Next line",
    keys: ["down", "j"],
    screens: ["review"],
    panes: ["tree", "diff", "review"],
    hint: "move",
    rank: 0,
  }),
  command({
    action: "cursor.prev",
    category: "Moving",
    title: "Previous line",
    keys: ["up", "k"],
    screens: ["review"],
  }),
  command({
    action: "cursor.top",
    category: "Moving",
    title: "Go to first line",
    keys: ["g", "home"],
    screens: ["review"],
  }),
  command({
    action: "cursor.bottom",
    category: "Moving",
    title: "Go to last line",
    keys: ["G", "end"],
    screens: ["review"],
  }),
  command({
    action: "cursor.pageDown",
    category: "Moving",
    title: "Half page down",
    keys: ["ctrl+d", "pagedown"],
    screens: ["review"],
  }),
  command({
    action: "cursor.pageUp",
    category: "Moving",
    title: "Half page up",
    keys: ["ctrl+u", "pageup"],
    screens: ["review"],
  }),
  command({
    action: "context.more",
    category: "Reading",
    title: "Show more context",
    keys: ["+", "="],
    screens: ["review"],
  }),
  command({
    action: "context.less",
    category: "Reading",
    title: "Show less context",
    keys: ["-", "_"],
    screens: ["review"],
  }),
  command({
    action: "context.whole",
    category: "Reading",
    title: "Show the whole file, or go back to the diff",
    keys: ["F"],
    screens: ["review"],
  }),
  command({
    action: "comment.next",
    category: "Comments",
    title: "Next comment",
    keys: ["n"],
    screens: ["review"],
    whenComments: true,
  }),
  command({
    action: "comment.prev",
    category: "Comments",
    title: "Previous comment",
    keys: ["N"],
    screens: ["review"],
  }),
  command({
    action: "hunk.next",
    category: "Moving",
    title: "Next change",
    keys: ["}"],
    screens: ["review"],
  }),
  command({
    action: "hunk.prev",
    category: "Moving",
    title: "Previous change",
    keys: ["{"],
    screens: ["review"],
  }),
  command({
    action: "file.next",
    panes: ["tree", "diff"],
    title: "Next file",
    category: "Files",
    keys: ["]", "right"],
    screens: ["review"],
    hint: "file",
    rank: 1,
  }),
  command({
    action: "file.prev",
    title: "Previous file",
    category: "Files",
    keys: ["[", "left"],
    screens: ["review"],
  }),
  command({
    action: "focus.toggle",
    title: "Switch pane",
    category: "Reading",
    keys: ["tab"],
    screens: ["review"],
  }),
  command({
    action: "focus.back",
    title: "Switch pane, the other way",
    category: "Reading",
    keys: ["shift+tab"],
    screens: ["review"],
    listed: false,
  }),
  command({
    action: "panel.toggle",
    also: ["comments", "threads", "conversation"],
    title: "Show or hide the review panel",
    category: "Comments",
    keys: ["a"],
    screens: ["review"],
    hint: "review",
  }),
  command({
    action: "nav.zoom",
    also: ["fullscreen", "maximise", "wide"],
    title: "Hide the file list and the review panel",
    category: "Reading",
    keys: ["z", "\\"],
    screens: ["review"],
  }),
  command({
    action: "branch.first",
    title: "Go to the first branch",
    category: "Branches",
    keys: ["g"],
    screens: ["branches"],
  }),
  command({
    action: "branch.last",
    title: "Go to the last branch",
    category: "Branches",
    keys: ["G"],
    screens: ["branches"],
  }),
  command({
    action: "select.grow",
    panes: ["diff"],
    title: "Take the line below into the selection",
    category: "Selecting",
    keys: ["shift+down"],
    screens: ["review"],
    listed: false,
  }),
  command({
    action: "select.shrink",
    panes: ["diff"],
    title: "Drop the last line from the selection",
    category: "Selecting",
    keys: ["shift+up"],
    screens: ["review"],
    listed: false,
  }),
  command({
    action: "select.hunk",
    category: "Selecting",
    title: "Select the change under the cursor",
    keys: ["V"],
    screens: ["review"],
  }),
  command({
    action: "selection.copy",
    panes: ["diff"],
    category: "Selecting",
    title: "Copy the selection, or the line the cursor is on",
    keys: ["y"],
    screens: ["review"],
    hint: "copy",
    whenSelecting: true,
    rank: 1,
  }),
  command({
    action: "search.open",
    also: ["search", "find", "grep", "look for", "where is"],
    category: "Reading",
    title: "Search this branch",
    keys: ["/"],
    screens: ["review"],
  }),
  command({
    action: "match.next",
    title: "Next match",
    category: "Search",
    keys: ["j", "down"],
    screens: ["search"],
  }),
  command({
    action: "match.prev",
    title: "Previous match",
    category: "Search",
    keys: ["k", "up"],
    screens: ["search"],
  }),
  command({
    action: "search.jump",
    title: "Open the file the match sits in",
    category: "Search",
    keys: ["return"],
    screens: ["search"],
    hint: "open",
    rank: 2,
  }),
  command({
    action: "select.swap",
    category: "Selecting",
    title: "Grow the selection from its other end",
    keys: ["o"],
    screens: ["review"],
  }),
  command({
    action: "sticky.toggle",
    panes: ["diff"],
    title: "Show or hide the scope above the diff",
    category: "Reading",
    keys: ["S"],
    screens: ["review"],
  }),
  command({
    action: "wrap.toggle",
    also: ["wrap", "soft wrap", "long lines"],
    title: "Wrap long lines",
    category: "Reading",
    keys: ["w"],
    screens: ["review"],
  }),
  command({
    action: "pan.right",
    category: "Reading",
    title: "Pan the diff right",
    keys: [">"],
    screens: ["review"],
  }),
  command({
    action: "pan.left",
    category: "Reading",
    title: "Pan the diff left",
    keys: ["<"],
    screens: ["review"],
  }),
  command({
    action: "base.open",
    also: ["base", "stacked on", "compare against", "diff against"],
    title: "Set what this branch is compared against",
    category: "Branches",
    keys: ["b"],
    screens: ["branches", "review"],
    hint: "base",
    rank: 5,
  }),
  command({
    action: "base.set",
    title: "Use the base under the cursor",
    category: "Branches",
    keys: ["return"],
    screens: ["base"],
    listed: false,
  }),
  command({
    action: "base.clear",
    title: "Let adiff work the base out again",
    category: "Branches",
    keys: ["ctrl+x"],
    screens: ["base"],
    hint: "automatic",
    listed: false,
  }),
  command({
    action: "base.next",
    title: "Next base",
    category: "Branches",
    keys: ["down"],
    screens: ["base"],
    listed: false,
  }),
  command({
    action: "base.prev",
    title: "Previous base",
    category: "Branches",
    keys: ["up"],
    screens: ["base"],
    listed: false,
  }),
  command({
    action: "review.reload",
    title: "Read the branches again",
    category: "Branches",
    keys: ["r"],
    screens: ["branches"],
    hint: "reload",
    rank: 3,
  }),
  command({
    action: "review.reload",
    title: "Read the branch again",
    category: "Branches",
    keys: ["r"],
    screens: ["review"],
  }),
  command({
    action: "thread.settle",
    also: ["settle", "resolve", "close", "done", "accept"],
    panes: ["diff", "review"],
    title: "Settle the thread here",
    category: "Comments",
    keys: ["d"],
    screens: ["review"],
    hint: "settle",
    whenThread: true,
  }),
  command({
    action: "thread.settleRead",
    panes: ["review"],
    title: "Settle every answer already read",
    category: "Comments",
    keys: ["D"],
    screens: ["review"],
    hint: "settle read",
    rank: 1,
  }),
  command({
    action: "remark.accept",
    also: ["accept", "take it on", "agree"],
    panes: ["review", "diff"],
    hint: "accept",
    rank: 1,
    title: "Take the remark here on as your own comment",
    category: "Comments",
    keys: ["A"],
    screens: ["review"],
    whenRemark: true,
  }),
  command({
    action: "thread.reply",
    also: ["reply", "respond", "answer", "write back"],
    panes: ["review", "diff"],
    hint: "reply",
    rank: 1,
    title: "Write back to the thread or remark here",
    category: "Comments",
    keys: ["R"],
    screens: ["review"],
    whenAnswerable: true,
  }),
  command({
    action: "thread.remove",
    also: ["remove", "delete", "withdraw", "retract", "undo"],
    panes: ["review"],
    hint: "remove",
    rank: 2,
    title: "Remove the comment here",
    category: "Comments",
    keys: ["X"],
    screens: ["review"],
  }),
  command({
    action: "panel.flip",
    panes: ["review"],
    hint: "order",
    rank: 4,
    title: "Read the review oldest first, or newest first",
    category: "Comments",
    keys: ["O"],
    screens: ["review"],
  }),
  command({
    action: "panel.winnow",
    panes: ["review"],
    title: "Hide the threads already settled",
    category: "Comments",
    keys: ["f"],
    screens: ["review"],
    hint: "hide settled",
    rank: 3,
  }),
  command({
    action: "tree.winnow",
    panes: ["tree", "diff"],
    title: "Hide the files already reviewed",
    category: "Files",
    keys: ["f"],
    screens: ["review"],
    hint: "hide read",
    whenReviewed: true,
    rank: 3,
  }),
  command({
    action: "nav.toggle",
    also: ["sidebar", "file list", "collapse", "expand", "hide files"],
    title: "Show or hide the file list",
    category: "Reading",
    keys: ["t"],
    screens: ["review"],
  }),
  command({
    action: "layers.ask",
    also: ["reading order", "plan", "walkthrough"],
    title: "Ask the agent for a reading order",
    category: "Files",
    keys: ["L"],
    screens: ["review"],
    hint: "new order",
    rank: 6,
    whenStale: true,
  }),
  command({
    action: "rail.toggle",
    also: ["sidebar", "outline", "toc"],
    panes: ["tree", "diff"],
    title: "Switch between layers and files",
    category: "Files",
    keys: ["s"],
    screens: ["review"],
    hint: "layers",
    rank: 2,
    whenLayers: true,
  }),
  command({
    action: "tree.collapse",
    also: ["fold", "hide", "shrink"],
    title: "Close the folder, layer, gap, or settled thread",
    category: "Files",
    keys: ["h"],
    screens: ["review"],
  }),
  command({
    action: "tree.expand",
    also: ["expand", "unfold", "show more", "open"],
    title: "Open the folder, layer, gap, or settled thread",
    category: "Files",
    keys: ["l"],
    screens: ["review"],
  }),
  command({
    action: "file.vouch",
    also: ["done", "approve", "tick", "check off"],
    panes: ["tree", "diff"],
    title: "Mark reviewed",
    category: "Files",
    keys: ["m"],
    screens: ["review"],
    hint: "reviewed",
    rank: 2,
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
    panes: ["diff"],
    category: "Selecting",
    title: "Start a selection",
    keys: ["v"],
    screens: ["review"],
    hint: "select",
    rank: 4,
  }),
  command({
    action: "compose.open",
    also: ["write", "note", "feedback", "say"],
    panes: ["diff"],
    category: "Comments",
    title: "Comment on the selection",
    keys: ["c", "return"],
    screens: ["review"],
    hint: "comment",
    rank: 3,
  }),
  command({
    action: "held.send",
    also: ["send", "dispatch", "flush", "send everything"],
    panes: ["diff", "tree", "review"],
    category: "Comments",
    title: "Send the comments you are holding",
    keys: ["C"],
    screens: ["review"],
    hint: "send",
    whenHeld: true,
    rank: 1,
  }),
  command({
    action: "report.open",
    title: "Report a bug",
    category: "App",
    keys: ["ctrl+b"],
    screens: ["branches", "review"],
  }),
  command({
    action: "report.mode",
    title: "Send a minimal report instead of a full one",
    category: "App",
    keys: ["ctrl+t"],
    screens: ["report"],
    listed: false,
  }),
  command({
    action: "report.send",
    category: "App",
    title: "Send the report",
    keys: ["ctrl+s"],
    screens: ["report"],
    hint: "copy",
    listed: false,
  }),
  command({
    action: "palette.open",
    also: ["commands", "actions", "what can i do"],
    title: "Find a command",
    category: "App",
    keys: ["ctrl+p"],
    screens: ["review"],
    listed: false,
  }),
  command({
    action: "compose.submit",
    category: "Comments",
    title: "Send the comment",
    keys: ["ctrl+s"],
    screens: ["compose"],
    hint: "send",
    listed: false,
  }),
  command({
    action: "palette.run",
    category: "App",
    title: "Run the highlighted command",
    keys: ["return"],
    screens: ["palette", "keys"],
    hint: "run",
    listed: false,
  }),
  command({
    action: "settings.open",
    also: ["preferences", "settings", "options", "config"],
    title: "Change what adiff does",
    category: "App",
    keys: [","],
    screens: ["branches", "review"],
    listed: false,
  }),
  command({
    action: "settings.next",
    title: "Next preference",
    category: "App",
    keys: ["down", "j"],
    screens: ["settings"],
    listed: false,
  }),
  command({
    action: "settings.prev",
    title: "Previous preference",
    category: "App",
    keys: ["up", "k"],
    screens: ["settings"],
    listed: false,
  }),
  command({
    action: "settings.flip",
    title: "Turn it on or off",
    category: "App",
    keys: ["return", "space"],
    screens: ["settings"],
    listed: false,
  }),
  command({
    action: "back",
    title: "Go back",
    category: "App",
    keys: ["escape", "q", ","],
    screens: ["settings"],
    listed: false,
  }),
  command({
    action: "keys.open",
    also: ["help", "shortcuts", "bindings", "keys"],
    title: "List every key",
    category: "App",
    keys: ["?"],
    screens: ["branches", "review", "search"],
    hint: "keys",
    rank: 5,
    listed: false,
  }),
  command({
    action: "keys.next",
    title: "Next key",
    category: "App",
    keys: ["down", "j"],
    screens: ["keys"],
    listed: false,
  }),
  command({
    action: "keys.prev",
    title: "Previous key",
    category: "App",
    keys: ["up", "k"],
    screens: ["keys"],
    listed: false,
  }),
  command({
    action: "back",
    title: "Go back",
    category: "App",
    keys: ["escape", "q"],
    screens: ["review", "compose", "palette", "report", "search", "keys"],
    hint: "back",
    listed: false,
    rank: 9,
  }),
  command({
    action: "quit",
    title: "Quit",
    category: "App",
    keys: ["q"],
    screens: ["branches"],
    hint: "quit",
    listed: false,
    rank: 9,
  }),
]

const TEXT_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  "compose",
  "keys",
  "palette",
  "report",
  "search",
])

const PRINTABLE_KEY = /^[\S ]$/

export const takesText = (screen: Screen): boolean => TEXT_SCREENS.has(screen)

export const commandsFor = (screen: Screen): ReadonlyArray<Command> =>
  commands.filter((entry) => entry.screens.includes(screen))

export const listableFor = (screen: Screen): ReadonlyArray<Command> =>
  commandsFor(screen).filter((entry) => entry.listed)

export const glossaryFor = (screen: Screen): ReadonlyArray<Command> =>
  commandsFor(screen).toSorted(
    (left, right) =>
      left.category.localeCompare(right.category) || left.title.localeCompare(right.title),
  )

export const actionFor = (screen: Screen, key: string, pane?: Pane): Action | undefined => {
  if (takesText(screen) && PRINTABLE_KEY.test(key)) return undefined
  const found = commandsFor(screen).filter((entry) => entry.keys.includes(key))
  const here = pane === undefined ? undefined : found.find((entry) => entry.panes.includes(pane))
  return (here ?? found[0])?.action
}

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

const heldOrRemoved = (offered: Offered): string => {
  if (offered.onHeld) return "drop"
  if (offered.onDismissed) return "restore"
  if (offered.onRemark) return "dismiss"
  return offered.onRemoved ? "restore" : "remove"
}

const SWAPPED: Readonly<Record<string, (offered: Offered) => string>> = {
  "rail.toggle": (offered) => (offered.onLayers ? "file tree" : "layers"),
  "tree.winnow": (offered) => (offered.hidingRead ? "show read" : "hide read"),
  "panel.winnow": (offered) => (offered.hidingSettled ? "show settled" : "hide settled"),
  "thread.remove": (offered) => heldOrRemoved(offered),
  "held.send": (offered) => `send ${offered.held}`,
}

const hintOf = (entry: Command, offered: Offered): string => {
  const swapped = SWAPPED[entry.action]
  if (swapped !== undefined) return swapped(offered)
  return entry.counted ? `${entry.hint} ${offered.comments}` : entry.hint
}

export const hintsFor = (
  screen: Screen,
  offered: Offered,
): ReadonlyArray<{ key: string; hint: string; press: string }> =>
  commandsFor(screen)
    .filter((entry) => entry.hint.length > 0)
    .filter((entry) => !entry.whenComments || offered.comments > 0)
    .filter((entry) => !entry.whenLayers || offered.layers > 0)
    .filter((entry) => !entry.whenStale || offered.stale)
    .filter((entry) => !entry.whenThread || offered.onThread)
    .filter((entry) => !entry.whenRemark || offered.onRemark || offered.onDismissed)
    .filter((entry) => !entry.whenAnswerable || offered.onThread || offered.onRemark)
    .filter((entry) => !entry.whenSelecting || offered.selecting)
    .filter((entry) => !entry.whenReviewed || offered.reviewed > 0)
    .filter((entry) => !entry.whenPull || offered.pull)
    .filter((entry) => !entry.whenHeld || offered.held > 0)
    .filter((entry) => entry.panes.includes(offered.pane))
    .toSorted((left, right) => left.rank - right.rank)
    .map((entry) => ({
      key: displayKey(entry.keys[0] ?? ""),
      hint: hintOf(entry, offered),
      press: entry.keys[0] ?? "",
    }))
