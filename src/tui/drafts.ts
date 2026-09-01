import type { StagedComment, TuiState } from "./model.ts"
import { withNotice } from "./reduce.ts"
import type { Terminal } from "./terminal.ts"

export const NOTHING_WRITTEN = "nothing written yet"

export const countOf = (many: number, one: string): string => `${many} ${one}${many === 1 ? "" : "s"}`

export const sentAway = (state: TuiState): TuiState => ({
  ...state,
  screen: "review",
  draft: "",
  draftAt: "",
  replyTo: undefined,
})

export const holding = (app: Terminal, comment: StagedComment): void => {
  const held = [...app.state.held, comment]
  app.commit(
    withNotice(
      sentAway({ ...app.state, held }),
      `held — ${countOf(held.length, "comment")} waiting, press C to send`,
    ),
  )
}
