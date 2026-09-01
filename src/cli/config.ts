import { Config } from "effect"

export const registryUrl = Config.option(Config.string("ADIFF_REGISTRY"))

export const upgradeRoute = Config.option(Config.string("ADIFF_UPGRADE_ROUTE"))

export const sessionPath = Config.option(Config.string("ADIFF_SESSION"))
