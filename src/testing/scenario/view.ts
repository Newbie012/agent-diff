import { noteSubject } from "./checking.ts"
import type { Bounds } from "./trace.ts"
import type { ScreenTestDriver } from "../domains/screen/index.ts"

export type Pane = "file list" | "diff" | "review panel"

const bodyRows = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").filter((row) => row.includes("│"))

const partsOf = (row: string): ReadonlyArray<string> => row.split("││")

export class View {
  private readonly screen: ScreenTestDriver
  private readonly held: string
  private shownPanes: ReadonlyArray<Pane> = []

  constructor(screen: ScreenTestDriver, frame: string) {
    this.screen = screen
    this.held = frame
  }

  frame(): string {
    return this.held
  }

  async panes(): Promise<ReadonlyArray<Pane>> {
    const found = (await this.screen.believes()).panes as ReadonlyArray<Pane>
    this.shownPanes = found
    noteSubject({ noun: "the panes on screen" })
    return found
  }

  header(): string {
    return this.held.split("\n")[0]?.trim() ?? ""
  }

  footer(): string {
    return this.held.split("\n").findLast((row) => row.trim().length > 0)?.trim() ?? ""
  }

  private about(noun: string, pane: Pane | undefined): void {
    const where = pane === undefined ? undefined : this.boundsOf(pane)
    noteSubject(where === undefined ? { noun } : { noun, where })
  }

  boundsOf(pane: Pane): Bounds | undefined {
    const rows = this.held.split("\n")
    const first = rows.findIndex((row) => row.includes("╭"))
    const last = rows.findLastIndex((row) => row.includes("╰"))
    const body = rows[first + 1]
    if (first === -1 || last === -1 || body === undefined) return undefined
    const parts = body.split("││")
    const at = this.shownPanes.indexOf(pane)
    if (at === -1) return undefined
    const before = parts.slice(0, at).join("││")
    const fromCol = at === 0 ? 0 : before.length + 2
    return {
      fromCol,
      toCol: fromCol + (parts[at]?.length ?? 0),
      fromRow: first,
      toRow: last,
    }
  }

  private paneRows(pane: Pane, shown: ReadonlyArray<Pane>): ReadonlyArray<string> {
    const at = shown.indexOf(pane)
    if (at === -1) return []
    return bodyRows(this.held).map((row) => partsOf(row)[at] ?? "")
  }

  private async rowsOf(pane: Pane): Promise<ReadonlyArray<string>> {
    this.shownPanes = await this.panes()
    return this.paneRows(pane, this.shownPanes)
  }

  async fileList(): Promise<ReadonlyArray<string>> {
    const rows = (await this.rowsOf("file list")).map((row) => row.replace(/^\s*│?/, "").trimEnd())
    this.about("the file list", "file list")
    return rows
  }

  async diff(): Promise<ReadonlyArray<string>> {
    const rows = (await this.rowsOf("diff")).map((row) => row.trimEnd())
    this.about("the diff", "diff")
    return rows
  }

  async reviewPanel(): Promise<ReadonlyArray<string>> {
    const rows = (await this.rowsOf("review panel")).map((row) => row.replace(/│\s*$/, "").trimEnd())
    this.about("the review panel", "review panel")
    return rows
  }

  async focus(): Promise<Pane> {
    const found = (await this.screen.believes()).focus as Pane
    this.shownPanes = await this.panes()
    this.about("the pane the keys reach", found)
    return found
  }

  says(said: string): boolean {
    return this.held.includes(said)
  }
}
