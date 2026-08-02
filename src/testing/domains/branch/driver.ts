import { mkdir, realpath, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { series, type DriverState } from "../../state.ts"
import type { BranchTestModel } from "./model.ts"

export class BranchTestDriver {
  constructor(private readonly state: DriverState) {}

  async withChange(model: BranchTestModel): Promise<string> {
    await this.commitBaseline(model)
    const worktree = join(dirname(this.state.repo), model.name)
    await this.state.git(this.state.repo, ["worktree", "add", "-q", "-b", model.name, worktree])
    await Promise.all(model.files.map((file) => this.write(worktree, file.path, file.after)))
    return realpath(worktree)
  }

  async commit(worktree: string, message: string): Promise<void> {
    await this.state.git(worktree, ["add", "-A"])
    await this.state.git(worktree, ["commit", "-q", "-m", message])
  }

  async rewrite(worktree: string, path: string, lines: ReadonlyArray<string>): Promise<void> {
    await this.write(worktree, path, lines)
  }

  private async commitBaseline(model: BranchTestModel): Promise<void> {
    await series(model.files, (file) => this.write(this.state.repo, file.path, file.before))
    await this.state.git(this.state.repo, ["add", "-A"])
    await this.state.git(this.state.repo, ["commit", "-q", "-m", "baseline"])
  }

  private async write(root: string, path: string, lines: ReadonlyArray<string>): Promise<void> {
    const absolute = join(root, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, `${lines.join("\n")}\n`, "utf8")
  }
}
