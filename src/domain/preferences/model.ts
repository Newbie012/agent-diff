export type Preference = {
  readonly name: string
  readonly title: string
  readonly about: string
  readonly byDefault: boolean
}

export const preferences: ReadonlyArray<Preference> = [
  {
    name: "wrap",
    title: "Wrap long lines",
    about: "Long lines wrap instead of running off the edge.",
    byDefault: false,
  },
  {
    name: "sticky",
    title: "Keep the heading in view",
    about: "The class or function you are inside stays pinned as you scroll.",
    byDefault: true,
  },
  {
    name: "panel",
    title: "Show the review panel",
    about: "Comments sit in their own pane beside the diff.",
    byDefault: true,
  },
  {
    name: "hideReviewed",
    title: "Hide files already read",
    about: "The file list shows only what you have not read yet.",
    byDefault: false,
  },
  {
    name: "hideSettled",
    title: "Hide threads already settled",
    about: "The review panel shows only threads still open.",
    byDefault: false,
  },
  {
    name: "newestFirst",
    title: "Read the newest comment first",
    about: "The newest comment sits at the top of the panel.",
    byDefault: true,
  },
  {
    name: "remarks",
    title: "Read the pull request's review",
    about: "The review shows the remarks left on the branch's pull request.",
    byDefault: false,
  },
  {
    name: "hold",
    title: "Hold comments until you send them",
    about: "Comments wait until you send them together, rather than going one at a time.",
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
