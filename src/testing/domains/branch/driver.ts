import { mkdir, realpath, rm, writeFile } from "node:fs/promises"
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
    await Promise.all(model.files.map((file) => this.lay(worktree, file)))
    return { ...model, worktree: await realpath(worktree) }
  }

  async stackOn(parent: CreatedBranch, options: CreateBranchOptions = {}): Promise<CreatedBranch> {
    const model = generateBranchTestModel(options)
    const worktree = join(dirname(this.state.repo), model.name)
    await this.state.git(this.state.repo, [
      "worktree",
      "add",
      "-q",
      "-b",
      model.name,
      worktree,
      parent.name,
    ])
    await series(model.files, (file) => this.lay(worktree, file))
    const stacked = { ...model, worktree: await realpath(worktree) }
    await this.commitAll(stacked, model.name)
    return stacked
  }

  async getHead(branch: CreatedBranch): Promise<string> {
    const found = await this.state.git(branch.worktree, ["rev-parse", "HEAD"])
    return found.trim()
  }

  async commitAll(branch: CreatedBranch, message: string): Promise<void> {
    await this.state.git(branch.worktree, ["add", "-A"])
    await this.state.git(branch.worktree, ["commit", "-q", "-m", message])
  }

  async setFile(branch: CreatedBranch, path: string, lines: ReadonlyArray<string>): Promise<void> {
    await this.write(branch.worktree, path, lines)
  }

  async setOwnFile(path: string, lines: ReadonlyArray<string>): Promise<void> {
    await this.write(this.state.repo, path, lines)
  }

  ownPath(): Promise<string> {
    return realpath(this.state.repo)
  }

  private async commitBaseline(model: BranchTestModel): Promise<void> {
    await series(model.files, (file) => this.write(this.state.repo, file.path, file.before))
    await this.state.git(this.state.repo, ["add", "-A"])
    await this.state.git(this.state.repo, ["commit", "-q", "--allow-empty", "-m", "baseline"])
  }

  private async lay(root: string, file: FileTestModel): Promise<void> {
    if (file.gone !== true) return this.write(root, file.path, file.after)
    await rm(join(root, file.path), { force: true })
  }

  async setRaw(branch: CreatedBranch, path: string, text: string): Promise<void> {
    const absolute = join(branch.worktree, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, text, "utf8")
  }

  async setBinary(branch: CreatedBranch, path: string, bytes: number): Promise<void> {
    const absolute = join(branch.worktree, path)
    await mkdir(dirname(absolute), { recursive: true })
    const made = Buffer.alloc(bytes)
    for (let at = 0; at < bytes; at += 1) made[at] = (at * 7) % 256
    await writeFile(absolute, made)
  }

  private async write(root: string, path: string, lines: ReadonlyArray<string>): Promise<void> {
    const absolute = join(root, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, `${lines.join("\n")}\n`, "utf8")
  }
}
