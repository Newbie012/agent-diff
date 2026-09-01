import { Effect } from "effect"
import { Store } from "../service/store/index.ts"
import {
  heldValue,
  preferenceNamed,
  preferenceNames,
  preferences,
} from "../domain/preferences/index.ts"
import { UnknownPreference, UnknownPreferenceValue } from "./error.ts"

export const readPreferences = Effect.fn("Review.readPreferences")(function* () {
  const store = yield* Store
  const kept = yield* store.settings
  return preferences.map((one) => ({
    name: one.name,
    about: one.about,
    value: heldValue(kept, one.name),
    byDefault: one.byDefault,
  }))
})

export const readPreference = Effect.fn("Review.readPreference")(function* (name: string) {
  const known = preferenceNamed(name)
  if (known === undefined) return yield* new UnknownPreference({ name, known: preferenceNames })
  const store = yield* Store
  const kept = yield* store.settings
  return { name, about: known.about, value: heldValue(kept, name), byDefault: known.byDefault }
})

const ON = "on"

const OFF = "off"

export const preferenceValue = Effect.fn("Review.preferenceValue")(function* (
  name: string,
  said: string,
) {
  const wanted = said.trim().toLowerCase()
  if (wanted === ON) return true
  if (wanted === OFF) return false
  return yield* new UnknownPreferenceValue({ name, value: said, known: [ON, OFF] })
})

export const savePreference = Effect.fn("Review.savePreference")(function* (
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
