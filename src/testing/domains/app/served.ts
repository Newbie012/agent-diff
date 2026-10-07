import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createInterface } from "node:readline"

export type Served = {
  readonly id: number | string
  readonly exit?: number
  readonly answer?: { readonly ok: boolean } & Record<string, unknown>
  readonly event?: string
}

type Waiter = {
  readonly wanted: (line: Served) => boolean
  readonly done: (line: Served) => void
}

export class ServedAdiff {
  private readonly child: ChildProcessWithoutNullStreams
  private readonly heard: Array<Served> = []
  private readonly waiters: Array<Waiter> = []
  private next = 0

  constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child
    createInterface({ input: child.stdout }).on("line", (line) => this.hear(line))
  }

  static start(command: string, args: ReadonlyArray<string>, env: NodeJS.ProcessEnv): ServedAdiff {
    return new ServedAdiff(spawn(command, [...args], { env, stdio: ["pipe", "pipe", "pipe"] }))
  }

  private hear(line: string): void {
    const parsed = JSON.parse(line) as Served
    this.heard.push(parsed)
    for (const waiter of Array.from(this.waiters)) {
      if (!waiter.wanted(parsed)) continue
      this.waiters.splice(this.waiters.indexOf(waiter), 1)
      waiter.done(parsed)
    }
  }

  private send(request: Record<string, unknown>): void {
    this.child.stdin.write(`${JSON.stringify(request)}\n`)
  }

  writeLine(text: string): void {
    this.child.stdin.write(`${text}\n`)
  }

  private takeId(): number {
    this.next += 1
    return this.next
  }

  heardFor(id: number | string, timeoutMs = 10_000): Promise<Served> {
    const wanted = (line: Served): boolean => line.id === id && line.event === undefined
    const already = this.heard.find(wanted)
    if (already !== undefined) return Promise.resolve(already)
    return this.until(wanted, timeoutMs)
  }

  until(wanted: (line: Served) => boolean, timeoutMs = 10_000): Promise<Served> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("serve said nothing in time")), timeoutMs)
      this.waiters.push({
        wanted,
        done: (line) => {
          clearTimeout(timer)
          resolve(line)
        },
      })
    })
  }

  ask(args: ReadonlyArray<string>): Promise<Served> {
    const id = this.takeId()
    this.send({ id, args })
    return this.heardFor(id)
  }

  async watch(args: ReadonlyArray<string>): Promise<{ readonly id: number; readonly answer: Served }> {
    const id = this.takeId()
    this.send({ id, watch: args })
    return { id, answer: await this.heardFor(id) }
  }

  changeOn(id: number, timeoutMs = 5000): Promise<Served> {
    return this.until((line) => line.id === id && line.event === "changed", timeoutMs)
  }

  async settledOn(id: number, quietMs = 600): Promise<void> {
    const heardBefore = (): number => this.heard.filter((line) => line.id === id).length
    let count = heardBefore()
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, quietMs))
      if (heardBefore() === count) return
      count = heardBefore()
    }
  }

  close(): void {
    this.child.stdin.end()
    this.child.kill()
  }
}
