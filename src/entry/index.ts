type ContainsClientServer = { client: string, server: string }
export type ClientServerEntry = Record<string, string> & ContainsClientServer
export type ObjectEntry = Record<string, string> | ClientServerEntry
export type MultiEntry = string[] | ObjectEntry
export type EntryShape = string | MultiEntry

type EntryShapes = 'Single' | 'Array' | 'Object' | 'Client' | 'Server'

export type ValidEntry = { valid: true, shape: EntryShapes, entry: EntryShape }
export type ValidatedEntry = { valid: false } | ValidEntry

export type DefaultAndExport = { default: string, exports?: string[] }

export const CLIENT_SERVER_DECIDER = '__default__'

export const CANDIDATE_ENTRIES: string[] = [
    "index.ts",
    "src/index.ts",
    "src/main.ts",
    "src/mod.ts",
    "lib/index.ts"
]

export * as Check from "./entryCheck"
export * as Tools from "./entryTools"