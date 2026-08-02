import { homedir } from "node:os"
import { join } from "node:path"

const NON_SLUG = /[^a-zA-Z0-9]+/g

export const slugOf = (worktreePath: string): string => worktreePath.replace(NON_SLUG, "-")

export const defaultRoot = (): string => join(homedir(), ".adiff")

export const branchDir = (root: string, worktreePath: string): string =>
  join(root, "branches", slugOf(worktreePath))

export const inboxPath = (root: string, worktreePath: string): string =>
  join(branchDir(root, worktreePath), "inbox.jsonl")

export const statePath = (root: string, worktreePath: string): string =>
  join(branchDir(root, worktreePath), "state.json")
