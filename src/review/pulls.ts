import { Effect } from "effect"
import { Forge, type PullState } from "../service/forge/index.ts"
import { NoPull } from "./error.ts"

export type ReportedPull = {
  readonly branch: string
  readonly number: number
  readonly url: string
  readonly state: PullState
  readonly draft: boolean
  readonly author: string
  readonly theirs: boolean
}

export const show = Effect.fn("Review.Pull.show")(function* (repo: string, branch: string) {
  const forge = yield* Forge
  const pulls = yield* forge.pulls(repo)
  const found = pulls.find((pull) => pull.branch === branch)
  if (found === undefined) return yield* new NoPull({ branch })
  const where = yield* forge.address(repo, branch)
  return {
    branch,
    number: where.number,
    url: where.url,
    state: found.state,
    draft: found.state === "draft",
    author: found.author,
    theirs: found.theirs,
  } satisfies ReportedPull
})
