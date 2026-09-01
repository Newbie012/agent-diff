import type { KeyEvent } from "@opentui/core"
import type { Screen } from "./model.ts"

const LISTENS: ReadonlySet<Screen> = new Set<Screen>(["keys", "palette", "search", "base", "editor"])

const WRITES: ReadonlySet<Screen> = new Set<Screen>(["compose", "report"])

export const overReview = (screen: Screen): boolean => screen !== "branches" && screen !== "review"

export const writesInto = (screen: Screen): boolean => WRITES.has(screen)

export const listens = (screen: Screen): boolean => LISTENS.has(screen)

const LETTER = /^[a-z]$/i

const ARROWS: ReadonlySet<string> = new Set(["up", "down", "left", "right"])

const SHIFTED: Readonly<Record<string, string>> = {
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": '"',
  ",": "<",
  ".": ">",
  "/": "?",
  "`": "~",
}

const typed = (key: KeyEvent): string => {
  if (key.baseCode === undefined || key.name.length !== 1) return key.name
  const laid = String.fromCodePoint(key.baseCode)
  return LETTER.test(laid) ? laid : key.name
}

export const keyName = (key: KeyEvent): string => {
  if (key.shift && (key.name === "tab" || ARROWS.has(key.name))) return `shift+${key.name}`
  const named = typed(key)
  const base = key.shift && named.length === 1 ? (SHIFTED[named] ?? named.toUpperCase()) : named
  return key.ctrl ? `ctrl+${base}` : base
}

export const keyNamed = (name: string): KeyEvent =>
  (name.startsWith("ctrl+")
    ? { name: name.slice(5), sequence: name.slice(5), ctrl: true, shift: false }
    : { name, sequence: name, ctrl: false, shift: false }) as KeyEvent
