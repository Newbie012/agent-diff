import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"

export type Where = {
  readonly fromCol: number
  readonly toCol: number
  readonly fromRow: number
  readonly toRow: number
}

export type Beat = {
  readonly kind: "step" | "check"
  readonly does: string
  readonly from: number
  readonly to: number
  readonly where?: Where
}

export type Seat = { readonly cols: number; readonly rows: number }

export type Narration = {
  readonly seat: Seat
  readonly asks: string
  readonly proves: string
  readonly beats: ReadonlyArray<Beat>
  readonly lead: number
}

const FONTS = [
  "/System/Library/Fonts/SFNSMono.ttf",
  "/System/Library/Fonts/Menlo.ttc",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
]

const FONT = FONTS.find((path) => existsSync(path)) ?? FONTS[0]

const clean = (said: string): string =>
  said
    .replaceAll(/[\\:%']/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()

const sizeOf = (path: string): { readonly wide: number; readonly tall: number } => {
  const said = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
    { encoding: "utf8" },
  ).trim()
  const [wide, tall] = said.split(",").map((one) => Number(one))
  return { wide: wide ?? 1920, tall: tall ?? 1080 }
}

type Band = { readonly y: number; readonly height: number; readonly wide: number }

const box = (band: Band, colour: string, when: string): string =>
  `drawbox=x=0:y=${band.y}:w=${band.wide}:h=${band.height}:color=${colour}:t=fill:enable='${when}'`

type Ink = {
  readonly said: string
  readonly size: number
  readonly colour: string
  readonly y: number
  readonly centred: boolean
}

const text = (ink: Ink, when: string): string =>
  `drawtext=fontfile=${FONT}:text='${clean(ink.said)}':fontcolor=${ink.colour}:fontsize=${ink.size}:x=${ink.centred ? "(w-tw)/2" : "48"}:y=${ink.y}:enable='${when}'`

const between = (beat: Beat): string => `between(t,${beat.from.toFixed(2)},${beat.to.toFixed(2)})`

const stepBand = (beat: Beat, wide: number, tall: number): ReadonlyArray<string> => {
  const size = Math.round(tall / 32)
  const height = Math.round(size * 2.4)
  const y = tall - height
  const when = between(beat)
  return [
    box({ y, height, wide }, "0x0b0e13", when),
    box({ y, height: 2, wide }, "0x2f3a4d", when),
    text(
      {
        said: beat.does,
        size,
        colour: "0xc8d0dc",
        y: Math.round(y + height / 2 - size * 0.62),
        centred: false,
      },
      when,
    ),
  ]
}

type Frame = { readonly seat: Seat; readonly wide: number; readonly tall: number }

const RING = 4

const ringOn = (where: Where, frame: Frame, when: string, floor: number): string => {
  const { seat, wide, tall } = frame
  const cell = { w: wide / seat.cols, h: tall / seat.rows }
  const x = Math.round(where.fromCol * cell.w)
  const y = Math.round(where.fromRow * cell.h)
  const right = Math.min(wide, Math.round(where.toCol * cell.w))
  const bottom = Math.min(floor, Math.round((where.toRow + 1) * cell.h))
  return `drawbox=x=${x}:y=${y}:w=${right - x}:h=${bottom - y}:color=0x7bc275:t=${RING}:enable='${when}'`
}

const checkCard = (
  beat: Beat,
  seat: Seat,
  wide: number,
  tall: number,
): ReadonlyArray<string> => {
  const size = Math.round(tall / 24)
  const height = Math.round(size * 2.3)
  const y = tall - height
  const when = between(beat)
  return [
    ...(beat.where === undefined ? [] : [ringOn(beat.where, { seat, wide, tall }, when, y - 6)]),
    box({ y, height, wide }, "0x11301c", when),
    box({ y, height: 5, wide }, "0x7bc275", when),
    text(
      { said: beat.does, size, colour: "0xffffff", y: Math.round(y + height / 2 - size * 0.62), centred: true },
      when,
    ),
  ]
}

const titleCard = (
  said: Narration,
  wide: number,
  tall: number,
): ReadonlyArray<string> => {
  const size = Math.round(tall / 20)
  const small = Math.round(tall / 38)
  const when = `lt(t,${said.lead})`
  return [
    box({ y: 0, height: tall, wide }, "0x05070a@0.94", when),
    text(
      { said: said.asks, size: small, colour: "0x8b95a7", y: Math.round(tall / 2 - size * 1.5), centred: true },
      when,
    ),
    text(
      { said: said.proves, size, colour: "0xffffff", y: Math.round(tall / 2 - size * 0.2), centred: true },
      when,
    ),
  ]
}

export const narrate = (raw: string, out: string, said: Narration): void => {
  const { wide, tall } = sizeOf(raw)
  const shifted = said.beats.map((beat) => ({
    ...beat,
    from: beat.from + said.lead,
    to: beat.to + said.lead,
  }))
  const filters = [
    ...titleCard(said, wide, tall),
    ...shifted.flatMap((beat) =>
      beat.kind === "check" ? checkCard(beat, said.seat, wide, tall) : stepBand(beat, wide, tall),
    ),
  ]
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel", "error",
      "-i", raw,
      "-vf", `tpad=start_duration=${said.lead}:start_mode=clone,${filters.join(",")}`,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      out,
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  )
}
