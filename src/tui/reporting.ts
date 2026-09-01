import { Effect } from "effect"
import { saveReport } from "../review/index.ts"
import { copyToClipboard } from "./clipboard.ts"
import type { Work } from "./needs.ts"
import { withNotice } from "./reduce.ts"
import { buildReport } from "./report.ts"
import type { Terminal } from "./terminal.ts"

export const sendReport = (app: Terminal): Work => {
  return Effect.gen(function* () {
    if (app.state.draft.trim().length === 0) {
      app.commit(withNotice(app.state, "say what went wrong first"))
      return
    }
    const text = buildReport(app.state, {
      repo: app.repo,
      base: app.base ?? "",
      ...app.diagnostics(),
      width: app.renderer.width,
      height: app.renderer.height,
    })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const path = yield* saveReport(stamp, text)
    copyToClipboard(text)
    const closed = { ...app.state, screen: app.state.returnTo, draft: "" }
    app.commit(withNotice(closed, `report copied — ${path}`))
  })
}
