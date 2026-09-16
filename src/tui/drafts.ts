import { withNotice } from "./reduce.ts"
import type { Terminal } from "./terminal.ts"
import type { StagedComment, TuiState } from "./state.ts"
import { counted } from "./words.ts"
import type { ReportedDraft } from "../review/index.ts"

export const heldOf = (drafts: ReadonlyArray<ReportedDraft>): ReadonlyArray<StagedComment> =>
  drafts.map((draft) => ({
    id: draft.id,
    at: draft.at,
    file: draft.file,
    side: draft.side,
    start: draft.start,
    end: draft.end,
    body: draft.body,
    snippet: draft.snippet,
    rewritten: draft.unread,
  }))

export const HELD_FOR_AUTHOR = "held for the author"

export const NOTHING_WRITTEN = "nothing written yet"

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
      `held — ${counted(held.length, "comment")} waiting, press C to send`,
    ),
  )
}
