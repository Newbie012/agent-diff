import type { Effect } from "effect"
import type {
  MalformedLayers,
  MissingOption,
  NoLayers,
  UnknownBase,
  UnknownBranch,
  UnknownComment,
  UnknownRemark,
  RemarkTaken,
  UnknownFile,
  UnknownWorktree,
  UnselectableRange,
} from "../cli/index.ts"
import type { Forge, ForgeUnavailable } from "../service/forge/index.ts"
import type { FileUnreadable, Git, GitCommandFailed, NotARepository } from "../service/git/index.ts"
import type { Store, StoreUnreadable, StoreUnwritable } from "../service/store/index.ts"

export type Needs = Git | Store | Forge

export type Fault =
  | MalformedLayers
  | MissingOption
  | NoLayers
  | UnknownBase
  | UnknownBranch
  | UnknownComment
  | UnknownFile
  | UnknownRemark
  | RemarkTaken
  | UnknownWorktree
  | UnselectableRange
  | ForgeUnavailable
  | FileUnreadable
  | GitCommandFailed
  | NotARepository
  | StoreUnreadable
  | StoreUnwritable

export type Work<A = void> = Effect.Effect<A, Fault, Needs>
