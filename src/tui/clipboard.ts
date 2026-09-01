import { spawn } from "node:child_process"
import { platform } from "node:os"

const COPIERS: Readonly<Record<string, ReadonlyArray<string>>> = {
  darwin: ["pbcopy"],
  linux: ["xclip", "-selection", "clipboard"],
  win32: ["clip"],
}

const copier = (): ReadonlyArray<string> | undefined =>
  process.env["WAYLAND_DISPLAY"] === undefined ? COPIERS[platform()] : ["wl-copy"]

const pipeToCopier = (text: string): void => {
  if (!process.stdout.isTTY) return
  const [command, ...rest] = copier() ?? []
  if (command === undefined) return
  const pipe = spawn(command, rest, { stdio: ["pipe", "ignore", "ignore"] })
  pipe.on("error", () => undefined)
  pipe.stdin.on("error", () => undefined)
  pipe.stdin.end(text)
}

const throughMultiplexer = (sequence: string): string => {
  if (process.env["TMUX"] !== undefined) return `Ptmux;${sequence}\\`
  return process.env["STY"] === undefined ? sequence : `P${sequence}\\`
}

export const copyToClipboard = (text: string): void => {
  const encoded = Buffer.from(text, "utf8").toString("base64")
  process.stdout.write(throughMultiplexer(`]52;c;${encoded}`))
  pipeToCopier(text)
}
