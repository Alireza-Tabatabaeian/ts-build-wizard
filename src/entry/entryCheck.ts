import {CANDIDATE_ENTRIES, ClientServerEntry, EntryShape, MultiEntry} from "./index"
import {parseEntry} from "./entryTools"


export const isString = (obj: any): obj is string => typeof obj === "string" && obj.trim().length > 0

export const isGlob = (entry: EntryShape) : entry is string => typeof entry === "string" && /[*?]/.test(entry)

export const isStringEntry = (entry: any): entry is string => (typeof entry === "string" && !isGlob(entry))

export const isClientServer = (entry: any): entry is ClientServerEntry => (
    typeof entry === "object" &&
    entry.hasOwnProperty('client') &&
    entry.hasOwnProperty('server')
)

export const isMultiEntry = (entry: any): entry is MultiEntry => {
    if (Array.isArray(entry)) return entry.length > 1
    if (entry && typeof entry === "object") return Object.keys(entry).length > 1
    return false
}

export const isMultiOrGlob = (entry: any): boolean => {
    if (isMultiEntry(entry)) return true
    return isGlob(entry)
}

export const isDefaultEntry = (path: string) : boolean => CANDIDATE_ENTRIES.includes(path)

export const canMerge = (entry: any) => {
    const parsed = parseEntry(entry)
    return isMultiOrGlob(parsed) && !isClientServer(parsed)
}