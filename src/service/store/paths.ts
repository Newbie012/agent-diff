import { homedir } from "node:os"
import { join } from "node:path"

const NON_SLUG = /[^a-zA-Z0-9]+/g

export const slugOf = (worktreePath: string): string => worktreePath.replace(NON_SLUG, "-")

export const defaultRoot = (): string => join(homedir(), ".adiff")

export const branchDir = (root: string, worktreePath: string): string =>
  join(root, "branches", slugOf(worktreePath))

export const inboxPath = (root: string, worktreePath: string): string =>
  join(branchDir(root, worktreePath), "inbox.jsonl")

export const outboxPath = (root: string, worktreePath: string): string =>
  join(branchDir(root, worktreePath), "outbox.jsonl")

export const statePath = (root: string, worktreePath: string): string =>
  join(branchDir(root, worktreePath), "state.json")

export const draftsPath = (root: string, worktreePath: string): string =>
  join(branchDir(root, worktreePath), "drafts.json")

export const layersPath = (root: string, worktreePath: string): string =>
  join(branchDir(root, worktreePath), "layers.json")

export const settingsPath = (root: string): string => join(root, "settings.json")

export const upgradePath = (root: string): string => join(root, "upgrade.json")

export const reportsDir = (root: string): string => join(root, "reports")

export const reportPath = (root: string, stamp: string): string =>
  join(reportsDir(root), `${stamp}.md`)
