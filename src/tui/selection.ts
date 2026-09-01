import { copyToClipboard } from "./clipboard.ts"
import { pickedText, selectedLines, selectedPatch, threadAtStop, type TuiState } from "./model.ts"
import { withNotice, withNoticeHere } from "./reduce.ts"
import type { Terminal } from "./terminal.ts"

const lineUnder = (state: TuiState): ReadonlyArray<string> => {
  const row = selectedPatch(state)?.rows[state.cursor]
  return row === undefined ? [] : [row.text]
}

export const copySelection = (app: Terminal, keep: boolean): void => {
  const said = keep ? withNoticeHere : withNotice
  const thread = app.state.selecting ? undefined : threadAtStop(app.state)
  if (thread !== undefined) {
    copyToClipboard(`${thread.body}\n`)
    app.commit(said(app.state, "comment copied"))
    return
  }
  const taken = pickedText(app.state)
  if (taken !== undefined) {
    copyToClipboard(taken)
    app.commit(said(app.state, `${taken.length} characters copied`))
    return
  }
  const lines = app.state.selecting ? selectedLines(app.state) : lineUnder(app.state)
  if (lines.length === 0) {
    app.commit(withNoticeHere(app.state, "nothing to copy"))
    return
  }
  copyToClipboard(`${lines.join("\n")}\n`)
  const many = lines.length === 1 ? "1 line copied" : `${lines.length} lines copied`
  app.commit(said(app.state, many))
}

export const copyDragged = (app: Terminal): void => {
  const taken = app.renderer.getSelection()?.getSelectedText() ?? ""
  if (taken.trim().length === 0) return
  copyToClipboard(taken)
  const lines = taken.split("\n").length
  const said = lines === 1 ? `${taken.length} characters copied` : `${lines} lines copied`
  app.commit(withNoticeHere(app.state, said))
}
