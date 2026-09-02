import type { Effect } from "effect"
import type { MissingOption } from "../cli/index.ts"
import type { Forge, ForgeUnavailable } from "../service/forge/index.ts"
import type { FileUnreadable, Git, GitCommandFailed, NotARepository } from "../service/git/index.ts"
import type { Store, StoreUnreadable, StoreUnwritable } from "../service/store/index.ts"
import type {
  MalformedLayers,
  NoLayers,
  NothingSaid,
  RemarkTaken,
  ThreadOpen,
  UnknownBase,
  UnknownBranch,
  UnknownComment,
  UnknownFile,
  UnknownRemark,
  UnknownWorktree,
  UnselectableRange,
} from "../review/index.ts"

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
  | ThreadOpen
  | NothingSaid
  | UnknownWorktree
  | UnselectableRange
  | ForgeUnavailable
  | FileUnreadable
  | GitCommandFailed
  | NotARepository
  | StoreUnreadable
  | StoreUnwritable

export type Work<A = void> = Effect.Effect<A, Fault, Needs>
