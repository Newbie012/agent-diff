#!/usr/bin/env node
// Proves the narration cannot be drawn over the terminal.
// A band that reaches past the strip must be refused, and a legal one must land below the screen.
import { drawn, inStrip, stripOf } from "./lib/narrate.ts"

const TALL = 1000
const strip = stripOf(TALL)

const refused = (y: number, height: number): boolean => {
  try {
    inStrip([drawn(`drawbox=x=0:y=${y}:w=10:h=${height}:color=0x000000:t=fill`, y, height)], TALL, strip)
    return false
  } catch {
    return true
  }
}

const wrong: Array<string> = []

if (!refused(-1, 10)) wrong.push("a band above the strip was not refused")
if (!refused(strip, 10)) wrong.push("a band below the strip was not refused")
if (!refused(0, strip + 1)) wrong.push("a band taller than the strip was not refused")

const legal = inStrip([drawn("drawbox=x=0:y=4:w=10:h=8:color=0x000000:t=fill", 4, 8)], TALL, strip)
if (legal[0]?.y !== TALL + 4) wrong.push("a legal band did not land below the screen")
if (!(legal[0]?.filter.includes(`y=${TALL + 4}`) ?? false)) {
  wrong.push("a legal band kept its strip coordinate in the filter it hands ffmpeg")
}

if (wrong.length > 0) {
  for (const said of wrong) console.log(`check-film: ${said}`)
  process.exit(1)
}

console.log(`check-film: the narration strip is ${strip} rows and refuses to reach the screen`)
