import { preferences } from "../../domain/preferences/index.ts"
import type { Step } from "./model.ts"

const step = (does: string, keys: ReadonlyArray<string>): Step => ({ does, keys })

const press = (key: string): string => `text:${key}`

const settle = (ms: number): string => `wait:${ms}`

export const openTheBranch = (): Step => step("open the branch", ["enter"])

export const goBack = (): Step => step("go back", ["escape"])

export const readTheNextFile = (): Step => step("read the next file", [press("]")])

export const readThePreviousFile = (): Step => step("read the previous file", [press("[")])

export const goDownALine = (times = 1): Step =>
  step(times === 1 ? "go down a line" : `go down ${times} lines`, Array.from({ length: times }, () => press("j")))

export const goUpALine = (times = 1): Step =>
  step(times === 1 ? "go up a line" : `go up ${times} lines`, Array.from({ length: times }, () => press("k")))

export const markTheFileReviewed = (): Step => step("mark the file reviewed", [press("m")])

export const showTheReviewPanel = (): Step => step("show the review panel", [press("a")])

export const hideTheReviewPanel = (): Step => step("hide the review panel", [press("a")])

export const showTheFileList = (): Step => step("show the file list", [press("t")])

export const hideTheFileList = (): Step => step("hide the file list", [press("t")])

export const swapTheRail = (): Step => step("swap between layers and files", [press("s")])

export const moveToTheOtherPane = (): Step => step("move to the other pane", ["tab"])

export const moveBackAPane = (): Step => step("move back a pane", ["shift-tab"])

export const openTheKeySheet = (): Step => step("open the key sheet", [press("?")])

export const askForAReadingOrder = (): Step => step("ask for a reading order", [press("L")])

export const hideFilesAlreadyRead = (): Step => step("hide the files already read", [press("f")])

export const leaveAComment = (said: string): Step =>
  step(`leave a comment saying "${said}"`, [press("c"), settle(1200), `text:${said}`, `until:${said}`, "ctrl-s"])

const preferenceAt = (name: string): number => preferences.findIndex((one) => one.name === name)

const turnOn = (name: string, said: string): Step =>
  step(said, [
    press(","),
    ...Array.from({ length: preferenceAt(name) }, () => press("j")),
    "enter",
    "escape",
  ])

export const holdCommentsUntilYouSendThem = (): Step =>
  turnOn("hold", "turn on holding comments until you send them")

export const tryToLeave = (): Step => step("try to leave", ["ctrl-c"])

export const sendTheCommentsYouAreHolding = (): Step =>
  step("send the comments you are holding", [press("C")])

export const dropTheCommentYouAreHolding = (): Step =>
  step("drop the comment you are holding", [press("X")])

export const openTheFolder = (): Step => step("open the folder", [press("l")])

export const closeTheFolder = (): Step => step("close the folder", [press("h")])
