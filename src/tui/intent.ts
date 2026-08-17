import type { KeyEvent } from "@opentui/core"
import { Data, type Deferred } from "effect"
import type { Work } from "./needs.ts"

export type Intent = Data.TaggedEnum<{
  Key: { readonly key: KeyEvent }
  Paste: { readonly text: string }
  Task: { readonly run: Work }
  Ping: { readonly done: Deferred.Deferred<void> }
}>

export const Intent = Data.taggedEnum<Intent>()
