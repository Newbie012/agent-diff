import { appendFileSync } from "node:fs"
import { env } from "node:process"
import type { BranchTestModel } from "../domains/branch/index.ts"
import type { LayersInput } from "../domains/app/index.ts"
import type { Seat, Step } from "./model.ts"

export type Moment =
  | { readonly kind: "step"; readonly does: string; readonly keys: ReadonlyArray<string> }
  | { readonly kind: "check"; readonly does: string; readonly checks: ReadonlyArray<string> }

export type Trace = {
  readonly test: string
  readonly world: { readonly branch: Partial<BranchTestModel>; readonly layers?: LayersInput }
  readonly seat: Seat
  readonly steps: ReadonlyArray<Step>
  readonly moments: ReadonlyArray<Moment>
}

const NAMED: Readonly<Record<string, string>> = {
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

export const tracing = (): boolean => (env["ADIFF_TRACE"] ?? "").length > 0

export class Tracer {
  private world: Trace["world"] = { branch: {} }
  private seat: Seat = { width: 120, height: 32 }
  private readonly steps: Array<Step> = []
  private readonly moments: Array<Moment> = []

  sawWorld(branch: Partial<BranchTestModel>): void {
    this.world = { ...this.world, branch }
  }

  sawLayers(layers: LayersInput): void {
    this.world = { ...this.world, layers }
  }

  sawSeat(seat: Seat): void {
    this.seat = seat
  }

  sawKeys(keys: ReadonlyArray<string>): void {
    const step = { does: keys.join(" "), keys: keys.map(asTermctrl) }
    this.steps.push(step)
    this.moments.push({ kind: "step", ...step })
  }

  sawCheck(does: string): void {
    const last = this.moments.at(-1)
    if (last?.kind === "check") {
      const held = last.checks.includes(does) ? last.checks : [...last.checks, does]
      this.moments[this.moments.length - 1] = {
        kind: "check",
        does: held.join(" · "),
        checks: held,
      }
      return
    }
    this.moments.push({ kind: "check", does, checks: [does] })
  }

  sawText(said: string): void {
    const step = {
      does: `type ${said}`,
      keys: ["wait:1200", `text:${said}`, `until:${said}`],
    }
    this.steps.push(step)
    this.moments.push({ kind: "step", ...step })
  }

  write(test: string): void {
    const path = env["ADIFF_TRACE"]
    if (path === undefined || path.length === 0 || this.steps.length === 0) return
    const held: Trace = {
      test,
      world: this.world,
      seat: this.seat,
      steps: this.steps,
      moments: this.moments,
    }
    appendFileSync(path, `${JSON.stringify(held)}\n`, "utf8")
  }
}
