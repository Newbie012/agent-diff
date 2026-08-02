import { Option } from "effect"
import type { Comment, CommentState } from "./model.ts"

const RANK: Readonly<Record<CommentState, number>> = {
  draft: 0,
  submitted: 1,
  seen: 2,
  working: 3,
  question: 4,
  done: 5,
  wontfix: 5,
}

const RESUMABLE: ReadonlySet<CommentState> = new Set<CommentState>(["question"])

const permits = (from: CommentState, to: CommentState): boolean =>
  RANK[to] > RANK[from] || RESUMABLE.has(from)

export const commentOn = (id: string, anchor: Comment["anchor"], body: string): Comment => ({
  id,
  anchor,
  body,
  state: "draft",
  reply: Option.none(),
})

export const advance = (
  comment: Comment,
  to: CommentState,
  reply: Option.Option<string>,
): Option.Option<Comment> =>
  permits(comment.state, to)
    ? Option.some({ ...comment, state: to, reply: Option.orElse(reply, () => comment.reply) })
    : Option.none()

export const needsAttention = (comments: ReadonlyArray<Comment>): ReadonlyArray<Comment> =>
  comments.filter((comment) => comment.state === "question")

export const stage = (staged: ReadonlyArray<Comment>, comment: Comment): ReadonlyArray<Comment> => [
  ...staged,
  comment,
]

export const submitAll = (staged: ReadonlyArray<Comment>): ReadonlyArray<Comment> =>
  staged.map((comment) => ({ ...comment, state: "submitted" as const }))
