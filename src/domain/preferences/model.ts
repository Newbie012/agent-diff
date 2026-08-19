export type Preference = {
  readonly name: string
  readonly about: string
  readonly byDefault: boolean
}

export const preferences: ReadonlyArray<Preference> = [
  {
    name: "wrap",
    about: "Wrap long lines instead of cutting them at the edge",
    byDefault: false,
  },
  {
    name: "sticky",
    about: "Keep the heading of what you are reading in view while you scroll",
    byDefault: true,
  },
  {
    name: "panel",
    about: "Show the review panel beside the diff",
    byDefault: true,
  },
  {
    name: "hideReviewed",
    about: "Leave files you have marked reviewed out of the file list",
    byDefault: false,
  },
  {
    name: "hideSettled",
    about: "Leave threads you have settled out of the review panel",
    byDefault: false,
  },
  {
    name: "newestFirst",
    about: "Read the review newest first, rather than oldest first",
    byDefault: true,
  },
  {
    name: "hold",
    about: "Hold comments until you send them together, rather than sending each as it is written",
    byDefault: false,
  },
]

export const preferenceNames: ReadonlyArray<string> = preferences.map((one) => one.name)

export const preferenceNamed = (name: string): Preference | undefined =>
  preferences.find((one) => one.name === name)

export const heldValue = (
  kept: Readonly<Record<string, boolean | undefined>>,
  name: string,
): boolean => kept[name] ?? preferenceNamed(name)?.byDefault ?? false

export const heldValues = (
  kept: Readonly<Record<string, boolean | undefined>>,
): Readonly<Record<string, boolean>> =>
  Object.fromEntries(preferences.map((one) => [one.name, heldValue(kept, one.name)]))
