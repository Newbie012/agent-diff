import {
  BoxRenderable,
  DiffRenderable,
  ScrollBoxRenderable,
  SyntaxStyle,
  TextRenderable,
  getTreeSitterClient,
  pathToFiletype,
  type CliRenderer,
} from "@opentui/core"
import { bindingsFor } from "./keymap.ts"
import { renderPatch, type Rendered } from "../domain/patch/index.ts"
import { selectedBranch, selectedPatch, selectionRange, type TuiState } from "./model.ts"
import { palette, syntaxTheme } from "./theme.ts"

const ROW_HEIGHT = 1
const COMPOSE_WIDTH = 72
const COMPOSE_HEIGHT = 6

const bar = (renderer: CliRenderer, id: string, fg: string): TextRenderable =>
  new TextRenderable(renderer, { id, content: "", fg, height: ROW_HEIGHT, flexShrink: 0, paddingLeft: 1 })

const makeDiff = (renderer: CliRenderer): DiffRenderable =>
  new DiffRenderable(renderer, {
    id: "diff",
    diff: "",
    view: "unified",
    showLineNumbers: true,
    wrapMode: "none",
    width: "100%",
    syntaxStyle: SyntaxStyle.fromStyles(syntaxTheme),
    treeSitterClient: getTreeSitterClient(),
    addedBg: palette.addedBg,
    removedBg: palette.removedBg,
    addedSignColor: palette.added,
    removedSignColor: palette.removed,
    lineNumberFg: palette.faint,
  })

const makeCompose = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "compose",
    position: "absolute",
    width: COMPOSE_WIDTH,
    height: COMPOSE_HEIGHT,
    zIndex: 100,
    visible: false,
    backgroundColor: palette.overlay,
    paddingLeft: 2,
    paddingRight: 2,
    flexDirection: "column",
  })


export class Screen {
  private readonly header: TextRenderable
  private readonly body: BoxRenderable
  private readonly list: TextRenderable
  private readonly diffPane: BoxRenderable
  private readonly diffScroll: ScrollBoxRenderable
  private readonly diff: DiffRenderable
  private readonly compose: BoxRenderable
  private readonly composeBody: TextRenderable
  private readonly footer: TextRenderable
  private rendered: Rendered = { text: "", lineOfRow: [] }
  private lastPath = ""
  private lastBlob = ""

  private readonly renderer: CliRenderer

  constructor(renderer: CliRenderer) {
    this.renderer = renderer
    renderer.root.flexDirection = "column"

    this.header = bar(renderer, "header", palette.ink)
    this.footer = bar(renderer, "footer", palette.faint)
    this.body = new BoxRenderable(renderer, {
      id: "body",
      flexGrow: 1,
      flexDirection: "row",
      minHeight: 0,
    })
    this.list = new TextRenderable(renderer, { id: "list", content: "", fg: palette.ink, paddingLeft: 1 })
    this.diffPane = new BoxRenderable(renderer, {
      id: "diff-pane",
      flexGrow: 1,
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      visible: false,
    })
    this.diffScroll = new ScrollBoxRenderable(renderer, {
      id: "diff-scroll",
      flexGrow: 1,
      verticalScrollbarOptions: { visible: false },
      horizontalScrollbarOptions: { visible: false },
    })
    this.diff = makeDiff(renderer)
    this.compose = makeCompose(renderer)
    this.composeBody = new TextRenderable(renderer, { id: "compose-body", content: "", fg: palette.ink })

    this.diffScroll.add(this.diff)
    this.diffPane.add(this.diffScroll)
    this.body.add(this.list)
    this.body.add(this.diffPane)
    this.compose.add(this.composeBody)

    renderer.root.add(this.header)
    renderer.root.add(this.body)
    renderer.root.add(this.footer)
    renderer.root.add(this.compose)
  }

  update(state: TuiState): void {
    this.header.content = this.headerText(state)
    this.footer.content = this.footerText(state)
    this.list.content = this.listText(state)
    this.diffPane.visible = state.screen !== "branches"
    if (state.screen !== "branches") this.paintDiff(state)
    this.paintCompose(state)
  }

  private headerText(state: TuiState): string {
    const branch = selectedBranch(state)
    if (state.screen === "branches") return `adiff  ${state.branches.length} branches`
    const patch = selectedPatch(state)
    const position = `${state.patchIndex + 1}/${state.patches.length}`
    return `${branch?.branch ?? ""}  ${patch?.path ?? ""}  ${position}`
  }

  private footerText(state: TuiState): string {
    const hints = bindingsFor(state.screen)
      .filter((binding) => binding.hint.length > 0)
      .map((binding) => `${binding.keys[0]} ${binding.hint}`)
      .join("   ")
    return state.notice.length > 0 ? `${hints}      ${state.notice}` : hints
  }

  private listText(state: TuiState): string {
    if (state.screen === "branches") {
      return state.branches
        .map((branch, index) => {
          const marker = index === state.branchIndex ? ">" : " "
          return `${marker} ${branch.branch}  +${branch.added} -${branch.removed}  ${branch.files}f`
        })
        .join("\n")
    }
    return state.patches
      .map((patch, index) => `${index === state.patchIndex ? ">" : " "} ${patch.path}`)
      .join("\n")
  }

  private paintDiff(state: TuiState): void {
    const patch = selectedPatch(state)
    if (patch === undefined) return
    if (patch.path !== this.lastPath || patch.blob !== this.lastBlob) {
      this.rendered = renderPatch(patch)
      this.diff.filetype = pathToFiletype(patch.path) ?? "text"
      this.diff.diff = this.rendered.text
      this.diff.height = Math.max(1, this.rendered.text.split("\n").length)
      this.lastPath = patch.path
      this.lastBlob = patch.blob
    }
    this.diff.setLineColors(this.lineColors(state))
    this.followCursor(state)
  }

  private lineColors(state: TuiState): Map<number, { gutter?: string; content?: string }> {
    const colors = new Map<number, { gutter?: string; content?: string }>()
    const [from, to] = selectionRange(state)
    if (state.selecting || state.screen === "compose") {
      for (let row = from; row <= to; row += 1) {
        const line = this.rendered.lineOfRow[row]
        if (line !== undefined) colors.set(line, { content: palette.selection })
      }
    }
    const cursorLine = this.rendered.lineOfRow[state.cursor]
    if (cursorLine !== undefined) colors.set(cursorLine, { gutter: palette.accent, content: palette.cursor })
    return colors
  }

  private followCursor(state: TuiState): void {
    const line = this.rendered.lineOfRow[state.cursor]
    if (line === undefined) return
    const height = Math.max(4, this.diffScroll.height)
    const top = this.diffScroll.scrollTop
    if (line < top) this.diffScroll.scrollTop = line
    else if (line >= top + height) this.diffScroll.scrollTop = line - height + 1
  }

  private paintCompose(state: TuiState): void {
    this.compose.visible = state.screen === "compose"
    if (state.screen !== "compose") return
    const [from, to] = selectionRange(state)
    const patch = selectedPatch(state)
    this.composeBody.content = `comment on ${patch?.path ?? ""} rows ${from + 1}-${to + 1}\n\n${state.draft}_`
    this.compose.left = Math.max(2, Math.floor((this.renderer.width - COMPOSE_WIDTH) / 2))
    this.compose.top = Math.max(2, Math.floor((this.renderer.height - COMPOSE_HEIGHT) / 2))
  }
}
