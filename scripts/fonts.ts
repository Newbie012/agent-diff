import { ASCIIFontRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"

const names = ["tiny", "block", "shade", "slick", "huge", "grid", "pallet"] as const

const show = async (name: (typeof names)[number]): Promise<void> => {
  const setup = await createTestRenderer({ width: 80, height: 12 })
  setup.renderer.root.add(
    new ASCIIFontRenderable(setup.renderer, { id: name, text: "adiff", font: name, color: "#ffffff" }),
  )
  await setup.flush()
  const rows = setup.captureCharFrame().split("\n").filter((r) => r.trim().length > 0)
  console.log(`\n--- ${name} (${rows.length} rows) ---`)
  console.log(rows.slice(0, 8).join("\n"))
  setup.renderer.destroy()
}

const series = async (rest: ReadonlyArray<(typeof names)[number]>): Promise<void> => {
  const [head, ...tail] = rest
  if (head === undefined) return
  await show(head)
  await series(tail)
}

await series(names)
process.exit(0)
