import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { Effect } from "effect"
import { editorsAround, openingOf, templateFor } from "../domain/editor/index.ts"
import { Store } from "../service/store/index.ts"
import { refHere, selectedBranch, selectedPatch, sourceLineAt } from "./model.ts"
import type { Work } from "./needs.ts"
import { worktreeFor } from "./reading.ts"
import { withChoices, withNotice, withNoticeHere } from "./reduce.ts"
import type { Terminal } from "./terminal.ts"

const ranAside = (command: string, args: ReadonlyArray<string>, from: string): boolean => {
  try {
    const child = spawn(command, [...args], { detached: true, stdio: "ignore", cwd: from })
    child.on("error", () => undefined)
    child.unref()
    return true
  } catch {
    return false
  }
}

const onThePath = (name: string): boolean =>
  (process.env["PATH"] ?? "")
    .split(":")
    .some((where) => where.length > 0 && existsSync(join(where, name)))

const saveEditor = Effect.fn("Tui.saveEditor")(function* (command: string) {
  const store = yield* Store
  const current = yield* store.settings
  const held = { ...current }
  if (command.length === 0) delete (held as Record<string, unknown>)["editor"]
  yield* store.saveSettings(command.length === 0 ? held : { ...held, editor: command })
})

const editorTold = Effect.gen(function* () {
  const store = yield* Store
  const kept = yield* store.settings
  const held = kept["editor"]
  return {
    editor: typeof held === "string" ? held : undefined,
    visual: process.env["VISUAL"],
    fallback: process.env["EDITOR"],
    termProgram: process.env["TERM_PROGRAM"],
    terminalEmulator: process.env["TERMINAL_EMULATOR"],
  }
})

export const chooseEditor = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const around = editorsAround(onThePath)
    const held = templateFor(yield* editorTold)
    const offered = held === undefined || around.includes(held) ? around : [held, ...around]
    app.commit(withChoices(app.state, offered, "editor", held ?? ""))
  })
}

export const editorChosen = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const chosen = refHere(app.state)
    if (chosen === undefined) return
    yield* saveEditor(chosen)
    app.commit({ ...app.state, screen: app.state.returnTo, query: "" })
    yield* openInEditor(app)
  })
}

export const forgetEditor = (app: Terminal): Work => {
  return Effect.gen(function* () {
    yield* saveEditor("")
    const back = { ...app.state, screen: app.state.returnTo, query: "" }
    app.commit(withNotice(back, "the editor is the environment's again"))
  })
}

export const openInEditor = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const where = whereTheLineIs(app)
    if (where === undefined) return
    const template = templateFor(yield* editorTold)
    const opening =
      template === undefined
        ? undefined
        : openingOf(template, where.file, where.line, where.root)
    if (opening === undefined) {
      yield* chooseEditor(app)
      return
    }
    const said = ranAside(opening.command, opening.args, where.root)
      ? `${where.path}:${where.line} in ${opening.command}`
      : `${opening.command} would not start`
    app.commit(withNoticeHere(app.state, said))
  })
}

type Where = {
  readonly file: string
  readonly path: string
  readonly root: string
  readonly line: number
}

export const whereTheLineIs = (app: Terminal): Where | undefined => {
  const branch = selectedBranch(app.state)
  const patch = selectedPatch(app.state)
  if (branch === undefined || patch === undefined) return undefined
  const held = worktreeFor(app, branch.branch)?.path ?? app.repo
  return {
    file: resolve(held, patch.path),
    path: patch.path,
    root: held,
    line: sourceLineAt(app.state, app.state.cursor) ?? 1,
  }
}
