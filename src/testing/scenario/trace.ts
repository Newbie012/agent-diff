import { appendFileSync } from "node:fs"
import { env } from "node:process"
import type { BranchTestModel } from "../domains/branch/index.ts"
import type { LayersInput } from "../domains/app/index.ts"
import { commands } from "../../tui/index.ts"
import type { Change, Seat, Step } from "./model.ts"

export type Bounds = {
  readonly fromCol: number
  readonly toCol: number
  readonly fromRow: number
  readonly toRow: number
}

export type Moment =
  | { readonly kind: "step"; readonly does: string; readonly keys: ReadonlyArray<string> }
  | {
      readonly kind: "check"
      readonly does: string
      readonly checks: ReadonlyArray<string>
      readonly where?: Bounds
    }

export type Trace = {
  readonly test: string
  readonly cannotReplay?: ReadonlyArray<string>
  readonly world: { readonly branch: Partial<BranchTestModel>; readonly layers?: LayersInput }
  readonly seat: Seat
  readonly changes?: ReadonlyArray<Change>
  readonly steps: ReadonlyArray<Step>
  readonly moments: ReadonlyArray<Moment>
}

const NAMED: Readonly<Record<string, string>> = {
  BACKSPACE: "backspace",
  "shift+UP": "shift-up",
  "shift+DOWN": "shift-down",
  RETURN: "enter",
  ESCAPE: "escape",
  TAB: "tab",
  "shift+tab": "shift-tab",
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
}

export const asTermctrl = (key: string): string => {
  const named = NAMED[key]
  if (named !== undefined) return named
  if (key.startsWith("ctrl+")) return `ctrl-${key.slice("ctrl+".length)}`
  return `text:${key}`
}

const SPELT: Readonly<Record<string, string>> = {
  RETURN: "return",
  ESCAPE: "escape",
  TAB: "tab",
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
}

const lower = (said: string): string => `${said.charAt(0).toLowerCase()}${said.slice(1)}`

export const saidFor = (keys: ReadonlyArray<string>, screen = "review"): string => {
  const spoken = keys.map((key) => {
    const wanted = SPELT[key] ?? key
    const found = commands.find(
      (one) => one.keys.includes(wanted) && one.screens.includes(screen as never),
    )
    return found === undefined ? undefined : lower(found.title)
  })
  const known = spoken.filter((one) => one !== undefined)
  return known.length === spoken.length && known.length > 0 ? known.join(", then ") : keys.join(" ")
}

export const tracing = (): boolean => (env["ADIFF_TRACE"] ?? "").length > 0

export class Tracer {
  private world: Trace["world"] = { branch: {} }
  private seat: Seat = { width: 120, height: 32 }
  private readonly steps: Array<Step> = []
  private readonly moments: Array<Moment> = []
  private naming: string | undefined
  private muted = false
  private readonly beyond: Array<string> = []
  private readonly changes: Array<Change> = []

  sawWorld(branch: Partial<BranchTestModel>): void {
    this.world = { ...this.world, branch }
  }

  sawLayers(layers: LayersInput): void {
    this.world = { ...this.world, layers }
  }

  sawSeat(seat: Seat): void {
    this.seat = seat
  }

  cannotReplay(what: string): void {
    if (!this.beyond.includes(what)) this.beyond.push(what)
  }

  saying(does: string | undefined): void {
    this.naming = does
  }

  sawStep(step: Step): void {
    this.steps.push(step)
    this.tookStep(step)
  }

  mute(on: boolean): void {
    this.muted = on
  }

  sawKeys(keys: ReadonlyArray<string>, screen?: string): void {
    if (this.muted) return
    const step = { does: this.naming ?? saidFor(keys, screen), keys: keys.map(asTermctrl) }
    this.steps.push(step)
    this.tookStep(step)
  }

  private tookStep(step: Step): void {
    const last = this.moments.at(-1)
    if (last?.kind === "step" && last.does === step.does) {
      this.moments[this.moments.length - 1] = {
        kind: "step",
        does: step.does,
        keys: [...last.keys, ...step.keys],
      }
      return
    }
    this.moments.push({ kind: "step", ...step })
  }

  sawChange(does: string, change: Change): void {
    const at = this.changes.length
    this.changes.push(change)
    const step = { does, keys: [`world:${at}`] }
    this.steps.push(step)
    this.tookStep(step)
  }

  sawCheck(does: string, where: Bounds | undefined): void {
    const last = this.moments.at(-1)
    if (last?.kind === "check") {
      const held = last.checks.includes(does) ? last.checks : [...last.checks, does]
      this.moments[this.moments.length - 1] = {
        kind: "check",
        does: held.join(" · "),
        checks: held,
        ...(last.where === undefined ? {} : { where: last.where }),
      }
      return
    }
    this.moments.push({ kind: "check", does, checks: [does], ...(where === undefined ? {} : { where }) })
  }

  sawText(said: string): void {
    if (this.muted) return
    const step = {
      does: this.naming ?? `write "${said}"`,
      keys: ["wait:1200", `text:${said}`, `until:${said}`],
    }
    this.steps.push(step)
    this.tookStep(step)
  }

  write(test: string): void {
    const path = env["ADIFF_TRACE"]
    if (path === undefined || path.length === 0 || this.steps.length === 0) return
    const held: Trace = {
      test,
      ...(this.beyond.length === 0 ? {} : { cannotReplay: this.beyond }),
      world: this.world,
      seat: this.seat,
      ...(this.changes.length === 0 ? {} : { changes: this.changes }),
      steps: this.steps,
      moments: this.moments,
    }
    appendFileSync(path, `${JSON.stringify(held)}\n`, "utf8")
  }
}
