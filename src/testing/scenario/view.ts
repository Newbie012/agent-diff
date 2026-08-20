import type { ScreenTestDriver } from "../domains/screen/index.ts"

export type Pane = "file list" | "diff" | "review panel"

const bodyRows = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").filter((row) => row.includes("│"))

const partsOf = (row: string): ReadonlyArray<string> => row.split("││")

export class View {
  private readonly screen: ScreenTestDriver
  private readonly held: string

  constructor(screen: ScreenTestDriver, frame: string) {
    this.screen = screen
    this.held = frame
  }

  frame(): string {
    return this.held
  }

  async panes(): Promise<ReadonlyArray<Pane>> {
    return (await this.screen.believes()).panes as ReadonlyArray<Pane>
  }

  header(): string {
    return this.held.split("\n")[0]?.trim() ?? ""
  }

  footer(): string {
    return this.held.split("\n").findLast((row) => row.trim().length > 0)?.trim() ?? ""
  }

  private paneRows(pane: Pane, shown: ReadonlyArray<Pane>): ReadonlyArray<string> {
    const at = shown.indexOf(pane)
    if (at === -1) return []
    return bodyRows(this.held).map((row) => partsOf(row)[at] ?? "")
  }

  private async rowsOf(pane: Pane): Promise<ReadonlyArray<string>> {
    return this.paneRows(pane, await this.panes())
  }

  async fileList(): Promise<ReadonlyArray<string>> {
    return (await this.rowsOf("file list")).map((row) => row.replace(/^\s*│?/, "").trimEnd())
  }

  async diff(): Promise<ReadonlyArray<string>> {
    return (await this.rowsOf("diff")).map((row) => row.trimEnd())
  }

  async reviewPanel(): Promise<ReadonlyArray<string>> {
    return (await this.rowsOf("review panel")).map((row) => row.replace(/│\s*$/, "").trimEnd())
  }

  async focus(): Promise<Pane> {
    return (await this.screen.believes()).focus as Pane
  }

  says(said: string): boolean {
    return this.held.includes(said)
  }
}
