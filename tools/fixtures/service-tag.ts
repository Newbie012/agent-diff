import { Context } from "effect"
export class Thing extends Context.Service<Thing, object>()("Thing") {}
