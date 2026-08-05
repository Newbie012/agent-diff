import { Effect } from "effect"

export const dropped = (): void => {
  Effect.succeed(1)
}
