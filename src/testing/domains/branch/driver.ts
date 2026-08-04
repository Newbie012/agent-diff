import { mkdir, realpath, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { series, type DriverState } from "../../state.ts"
import { generateBranchTestModel, type BranchTestModel, type FileTestModel } from "./model.ts"

export type CreateBranchOptions = {
  readonly name?: string
  readonly files?: ReadonlyArray<Partial<FileTestModel>>
}

export type CreatedBranch = BranchTestModel & {
  readonly worktree: string
}

export class BranchTestDriver {
  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  async create(options: CreateBranchOptions = {}): Promise<CreatedBranch> {
    const model = generateBranchTestModel(options)
    await this.commitBaseline(model)
    const worktree = join(dirname(this.state.repo), model.name)
    await this.state.git(this.state.repo, ["worktree", "add", "-q", "-b", model.name, worktree])
    await Promise.all(model.files.map((file) => this.write(worktree, file.path, file.after)))
    return { ...model, worktree: await realpath(worktree) }
  }

  async commitAll(branch: CreatedBranch, message: string): Promise<void> {
    await this.state.git(branch.worktree, ["add", "-A"])
    await this.state.git(branch.worktree, ["commit", "-q", "-m", message])
  }

  async setFile(branch: CreatedBranch, path: string, lines: ReadonlyArray<string>): Promise<void> {
    await this.write(branch.worktree, path, lines)
  }

  private async commitBaseline(model: BranchTestModel): Promise<void> {
    await series(model.files, (file) => this.write(this.state.repo, file.path, file.before))
    await this.state.git(this.state.repo, ["add", "-A"])
    await this.state.git(this.state.repo, ["commit", "-q", "--allow-empty", "-m", "baseline"])
  }

  private async write(root: string, path: string, lines: ReadonlyArray<string>): Promise<void> {
    const absolute = join(root, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, `${lines.join("\n")}\n`, "utf8")
  }
}
