import type { KeyEvent } from "@opentui/core"
import { Data, type Deferred } from "effect"

export type Intent = Data.TaggedEnum<{
  Key: { readonly key: KeyEvent }
  Task: { readonly run: () => Promise<void> }
  Ping: { readonly done: Deferred.Deferred<void> }
}>

export const Intent = Data.taggedEnum<Intent>()
