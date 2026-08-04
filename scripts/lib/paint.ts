type Rgb = { readonly r: number; readonly g: number; readonly b: number }

export type Span = { readonly text: string; readonly fg: Rgb; readonly bg: Rgb }

export type Line = { readonly spans: ReadonlyArray<Span> }

export type Shot = { readonly label: string; readonly lines: ReadonlyArray<Line> }

const byte = (value: number): number => Math.max(0, Math.min(255, Math.round(value * 255)))

const hex = (colour: Rgb): string =>
  `#${[colour.r, colour.g, colour.b].map((part) => byte(part).toString(16).padStart(2, "0")).join("")}`

const ansiSpan = (span: Span): string =>
  `[38;2;${byte(span.fg.r)};${byte(span.fg.g)};${byte(span.fg.b)}m[48;2;${byte(span.bg.r)};${byte(span.bg.g)};${byte(span.bg.b)}m${span.text}[0m`

export const toAnsi = (shot: Shot): string =>
  shot.lines.map((line) => line.spans.map(ansiSpan).join("")).join("\n")

const flat = (colour: Rgb): Rgb => ({ r: colour.r, g: colour.g, b: colour.b })

export const toPlain = (shot: Shot): Shot => ({
  label: shot.label,
  lines: shot.lines.map((line) => ({
    spans: line.spans.map((span) => ({ text: span.text, fg: flat(span.fg), bg: flat(span.bg) })),
  })),
})

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const htmlSpan = (span: Span): string =>
  `<span style="color:${hex(span.fg)};background:${hex(span.bg)}">${escape(span.text)}</span>`

const htmlShot = (shot: Shot, index: number): string =>
  [
    `<section class="shot" data-shot="${index}" hidden>`,
    `<pre>${shot.lines.map((line) => line.spans.map(htmlSpan).join("")).join("\n")}</pre>`,
    "</section>",
  ].join("")

const PLAYER = `
const shots = [...document.querySelectorAll(".shot")]
const layers = [...document.querySelectorAll(".layer")]
let at = 0
const show = (next) => {
  at = Math.max(0, Math.min(shots.length - 1, next))
  shots.forEach((shot, index) => { shot.hidden = index !== at })
  layers.forEach((layer, index) => layer.setAttribute("aria-current", String(index === at)))
  layers[at].scrollIntoView({ block: "nearest" })
}
layers.forEach((layer, index) => layer.addEventListener("click", () => show(index)))
const cell = () => {
  const box = screen.getBoundingClientRect()
  return { box, w: box.width / Math.max(1, cols), h: box.height / Math.max(1, rows) }
}
const at = (event) => {
  const { box, w, h } = cell()
  return { x: Math.max(0, Math.floor((event.clientX - box.left) / w)), y: Math.max(0, Math.floor((event.clientY - box.top) / h)) }
}
const post = (path, value) =>
  fetch(path, { method: "POST", body: JSON.stringify(value) }).then((res) => res.json()).then(paint)
let from
screen.addEventListener("mousedown", (event) => { from = at(event) })
addEventListener("mouseup", (event) => {
  if (from === undefined) return
  const to = at(event)
  post("/mouse", from.x === to.x && from.y === to.y ? { kind: "click", ...from } : { kind: "drag", ...from, to })
  from = undefined
})
let last = 0
screen.addEventListener("mousemove", (event) => {
  const now = Date.now()
  if (now - last < 60) return
  last = now
  post("/mouse", { kind: "move", ...at(event) })
})
screen.addEventListener("wheel", (event) => {
  event.preventDefault()
  const spot = at(event)
  post("/mouse", event.deltaY < 0 ? { kind: "wheel", ...spot, to: spot } : { kind: "wheel", ...spot })
}, { passive: false })
setInterval(() => { if (document.hasFocus()) fetch("/frame").then((res) => res.json()).then(paint).catch(() => undefined) }, 1200)
addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "j") show(at + 1)
  if (event.key === "ArrowLeft" || event.key === "k") show(at - 1)
})
show(0)
`

const LIVE = `
new EventSource("/events").onmessage = () => location.reload()
`

const KEYS = `
const screen = document.getElementById("screen")
let cols = 1
let rows = 1
const fit = () => {
  screen.style.fontSize = "16px"
  const wide = screen.scrollWidth
  const tall = screen.scrollHeight
  if (wide === 0 || tall === 0) return
  const room = Math.min((innerWidth - 8) / wide, (innerHeight - 8) / tall)
  screen.style.fontSize = Math.max(5, Math.floor(16 * room)) + "px"
}
addEventListener("resize", fit)
const paint = (shot) => {
  rows = shot.lines.length
  cols = Math.max(...shot.lines.map((line) => line.spans.reduce((n, s) => n + s.text.length, 0)))
  paintInto(shot)
  fit()
}
const paintInto = (shot) => {
  screen.innerHTML = shot.lines
    .map((line) =>
      line.spans
        .map((span) => {
          const hex = (c) => "#" + [c.r, c.g, c.b].map((p) => Math.round(p * 255).toString(16).padStart(2, "0")).join("")
          const safe = span.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          return '<span style="color:' + hex(span.fg) + ';background:' + hex(span.bg) + '">' + safe + "</span>"
        })
        .join(""),
    )
    .join("\\n")
}
const send = (key) =>
  fetch("/key", { method: "POST", body: key }).then((res) => res.json()).then(paint)
fetch("/frame").then((res) => res.json()).then(paint)
const NAMED = { Enter: "RETURN", Escape: "escape", ArrowDown: "ARROW_DOWN", ArrowUp: "ARROW_UP", ArrowLeft: "ARROW_LEFT", ArrowRight: "ARROW_RIGHT", Backspace: "BACKSPACE", Tab: "TAB", " ": " " }
const cell = () => {
  const box = screen.getBoundingClientRect()
  return { box, w: box.width / Math.max(1, cols), h: box.height / Math.max(1, rows) }
}
const at = (event) => {
  const { box, w, h } = cell()
  return { x: Math.max(0, Math.floor((event.clientX - box.left) / w)), y: Math.max(0, Math.floor((event.clientY - box.top) / h)) }
}
const post = (path, value) =>
  fetch(path, { method: "POST", body: JSON.stringify(value) }).then((res) => res.json()).then(paint)
let from
screen.addEventListener("mousedown", (event) => { from = at(event) })
addEventListener("mouseup", (event) => {
  if (from === undefined) return
  const to = at(event)
  post("/mouse", from.x === to.x && from.y === to.y ? { kind: "click", ...from } : { kind: "drag", ...from, to })
  from = undefined
})
let last = 0
screen.addEventListener("mousemove", (event) => {
  const now = Date.now()
  if (now - last < 60) return
  last = now
  post("/mouse", { kind: "move", ...at(event) })
})
screen.addEventListener("wheel", (event) => {
  event.preventDefault()
  const spot = at(event)
  post("/mouse", event.deltaY < 0 ? { kind: "wheel", ...spot, to: spot } : { kind: "wheel", ...spot })
}, { passive: false })
setInterval(() => { if (document.hasFocus()) fetch("/frame").then((res) => res.json()).then(paint).catch(() => undefined) }, 1200)
addEventListener("keydown", (event) => {
  const key = NAMED[event.key] ?? (event.ctrlKey ? "ctrl+" + event.key : event.key)
  if (event.key.length > 1 && NAMED[event.key] === undefined) return
  event.preventDefault()
  send(key)
})
`

export const playerPage = (title: string): string =>
  [
    `<title>${escape(title)}</title>`,
    "<style>",
    "html,body{height:100%}",
    "body{background:#0b0d12;margin:0;display:grid;place-items:center;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;user-select:none;-webkit-user-select:none;cursor:default}",
    `pre{margin:0;line-height:1;overflow:hidden;white-space:pre;font-size:16px}`,
    "pre span{display:inline-block;line-height:1.35;vertical-align:top}",
    "</style>",
    '<pre id="screen"></pre>',
    `<script>${KEYS}</script>`,
  ].join("\n")

export const holdingPage = (message: string, tone: "wait" | "bad"): string =>
  [
    "<title>adiff</title>",
    "<style>",
    "body{background:#0b0d12;color:#8b95a7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;padding:28px;font-size:12px}",
    `pre{margin:0;white-space:pre-wrap;color:${tone === "bad" ? "#e06c75" : "#8b95a7"}}`,
    "</style>",
    `<pre>${escape(message)}</pre>`,
    `<script>${LIVE}</script>`,
  ].join("\n")

export const toHtml = (shots: ReadonlyArray<Shot>, title: string, live = false): string =>
  [
    `<title>${escape(title)}</title>`,
    "<style>",
    ":root{--ground:#0b0d12;--ink:#c8d0dc;--dim:#8b95a7;--rule:#262b37;--accent:#7aa2f7}",
    "body{background:var(--ground);color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;padding:20px 24px;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:start;min-height:100vh;box-sizing:border-box}",
    "h1{grid-column:1/-1;display:flex;align-items:baseline;gap:16px;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin:0}",
    "h1 small{font-size:11px;font-weight:400;letter-spacing:.04em;text-transform:none;color:var(--dim)}",
    "nav{display:flex;flex-direction:column;gap:1px;position:sticky;top:20px;width:max-content;max-height:88vh;overflow-y:auto}",
    ".layer{all:unset;cursor:pointer;padding:4px 12px 4px 10px;border-radius:4px;font-size:12px;white-space:nowrap;color:var(--dim);border-left:2px solid transparent}",
    ".layer:hover{color:var(--ink);background:#141821}",
    ".layer:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",
    ".layer[aria-current=true]{color:var(--ink);background:#141821;border-left-color:var(--accent)}",
    "main{min-width:0}",
    "pre{margin:0;overflow-x:auto;line-height:1;font-size:clamp(8px,calc((100vw - 260px) / 70),19px);border:1px solid var(--rule);border-radius:8px;padding:12px}",
    "pre span{display:inline-block;line-height:1.35;vertical-align:top}",
    "@media (max-width:820px){body{grid-template-columns:1fr}nav{flex-direction:row;flex-wrap:wrap;position:static;width:auto}pre{font-size:clamp(7px,calc(100vw / 68),14px)}}",
    "</style>",
    `<h1>${escape(title)}<small>← → or j / k to layer through</small></h1>`,
    "<nav>",
    ...shots.map((shot) => `<button class="layer" type="button">${escape(shot.label)}</button>`),
    "</nav>",
    "<main>",
    ...shots.map(htmlShot),
    "</main>",
    `<script>${PLAYER}${live ? LIVE : ""}</script>`,
  ].join("\n")
