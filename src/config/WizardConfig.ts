import {EntryShape} from "../entry"


export type OutputFormats = ("esm" | "cjs" | "iife")[]

export type WizardConfig = {
    entry: EntryShape
    mergeInOne?: boolean
    outDir: string
    formats: OutputFormats
    platform: "node" | "browser" | "neutral"
    dts: boolean
    sourcemap: boolean
    minify: ("no" | "iife" | "all")
    clean: boolean
    autoExport: boolean
    formatDir?: boolean // e.g. dist/esm
    globalName?: string // for iife
}