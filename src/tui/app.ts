import { randomUUID } from "node:crypto"
import { createCliRenderer, type CliRenderer, type KeyEvent } from "@opentui/core"
import { Effect, Option } from "effect"
import { anchorFor } from "../domain/patch/index.ts"
import { listBranches, listPatches, submitComment } from "../cli/index.ts"
import type { Git } from "../service/git/index.ts"
import type { Store } from "../service/store/index.ts"
import { actionFor, type Action } from "./keymap.ts"
import { initialState, selectedBranch, selectedPatch, selectionRange, type TuiState } from "./model.ts"
import { backspaced, reduce, typed, withNotice, withPatches } from "./reduce.ts"
import { Screen } from "./render.ts"

type Needs = Git | Store

export type AppOptions = {
  readonly renderer: CliRenderer
  readonly repo: string
  readonly run: <A>(effect: Effect.Effect<A, unknown, Needs>) => Promise<A>
  readonly branches: TuiState["branches"]
}

const PRINTABLE = /^[\S ]$/

const keyName = (key: KeyEvent): string => (key.ctrl ? `ctrl+${key.name}` : key.name)

export class App {
  private state: TuiState
  private readonly screen: Screen
  private pending: Promise<void> = Promise.resolve()

  private readonly renderer: CliRenderer
  private readonly repo: string
  private readonly run: <A>(effect: Effect.Effect<A, unknown, Needs>) => Promise<A>

  constructor(options: AppOptions) {
    this.renderer = options.renderer
    this.repo = options.repo
    this.run = options.run
    const { branches, renderer } = options
    this.state = initialState(branches)
    this.screen = new Screen(renderer)
    this.screen.update(this.state)
    renderer.keyInput.on("keypress", (key) => this.dispatch(key))
  }

  private dispatch(key: KeyEvent): void {
    this.pending = this.pending.then(() => this.onKey(key))
  }

  settled(): Promise<void> {
    return this.pending
  }

  private commit(next: TuiState): void {
    this.state = next
    this.screen.update(next)
  }

  private async onKey(key: KeyEvent): Promise<void> {
    const action = actionFor(this.state.screen, keyName(key))
    if (action === undefined) return this.onText(key)
    if (action === "quit") return this.renderer.destroy()
    if (action === "branch.open") return this.openBranch()
    if (action === "compose.submit") return this.send()
    this.commit(reduce(this.state, action))
  }

  private onText(key: KeyEvent): void {
    if (this.state.screen !== "compose") return
    if (key.name === "backspace") return this.commit(backspaced(this.state))
    if (PRINTABLE.test(key.sequence)) this.commit(typed(this.state, key.sequence))
  }

  private async openBranch(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return
    const patches = await this.run(listPatches(this.repo, branch.branch))
    this.commit(withPatches(this.state, patches))
  }

  private async send(): Promise<void> {
    const patch = selectedPatch(this.state)
    const branch = selectedBranch(this.state)
    const [from, to] = selectionRange(this.state)
    if (patch === undefined || branch === undefined || this.state.draft.length === 0) return
    const anchor = anchorFor(patch, from, to)
    if (Option.isNone(anchor)) return this.commit(withNotice(this.state, "nothing selected"))
    await this.run(
      submitComment({
        repo: this.repo,
        branch: branch.branch,
        file: patch.path,
        side: anchor.value.side,
        start: anchor.value.start,
        end: anchor.value.end,
        body: this.state.draft,
        id: randomUUID(),
        at: new Date().toISOString(),
      }),
    )
    this.commit(withNotice(this.state, "sent to the agent"))
  }
}

export const launch = Effect.fn("Tui.launch")(function* (repo: string, renderer: CliRenderer) {
  const context = yield* Effect.context<Needs>()
  const branches = yield* listBranches(repo)
  return new App({ renderer, repo, run: Effect.runPromiseWith(context), branches })
})

const untilDestroyed = (renderer: CliRenderer): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    renderer.on("destroy", () => resume(Effect.void))
  })

export const runOn = Effect.fn("Tui.runOn")(function* (repo: string, renderer: CliRenderer) {
  yield* launch(repo, renderer)
  yield* untilDestroyed(renderer)
})

export const runTui = Effect.fn("Tui.run")(function* (repo: string) {
  const renderer = yield* Effect.promise(() => createCliRenderer({ exitOnCtrlC: true }))
  yield* runOn(repo, renderer)
})

export type { Action }
