import { Effect } from "effect"
import { Store } from "../service/store/index.ts"
import {
  heldValue,
  preferenceNamed,
  preferenceNames,
  preferences,
} from "../domain/preferences/index.ts"
import { UnknownPreference, UnknownPreferenceValue } from "./error.ts"

export const list = Effect.fn("Review.Preference.list")(function* () {
  const store = yield* Store
  const kept = yield* store.settings
  return preferences.map((one) => ({
    name: one.name,
    about: one.about,
    value: heldValue(kept, one.name),
    byDefault: one.byDefault,
  }))
})

export const read = Effect.fn("Review.Preference.read")(function* (name: string) {
  const known = preferenceNamed(name)
  if (known === undefined) return yield* new UnknownPreference({ name, known: preferenceNames })
  const store = yield* Store
  const kept = yield* store.settings
  return { name, about: known.about, value: heldValue(kept, name), byDefault: known.byDefault }
})

const ON = "on"

const OFF = "off"

export const parse = Effect.fn("Review.Preference.parse")(function* (
  name: string,
  said: string,
) {
  const wanted = said.trim().toLowerCase()
  if (wanted === ON) return true
  if (wanted === OFF) return false
  return yield* new UnknownPreferenceValue({ name, value: said, known: [ON, OFF] })
})

export const save = Effect.fn("Review.Preference.save")(function* (
  name: string,
  value: boolean,
) {
  const known = preferenceNamed(name)
  if (known === undefined) return yield* new UnknownPreference({ name, known: preferenceNames })
  const store = yield* Store
  const current = yield* store.settings
  yield* store.saveSettings({ ...current, [name]: value })
  return { name, about: known.about, value, byDefault: known.byDefault }
})
