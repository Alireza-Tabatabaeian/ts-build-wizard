import {
    isClientServer,
    isDefaultEntry,
    isGlob,
    isString,
    isStringEntry
} from "./entryCheck"

import {
    CLIENT_SERVER_DECIDER,
    ClientServerEntry,
    DefaultAndExport,
    EntryShape,
    MultiEntry, ObjectEntry,
    ValidatedEntry,
    ValidEntry
} from "./index"
import {exportFilesFromGlob, isValidPath} from "../fileTools"

/** Turn the entry prompt (string/array/object-ish) into a real value */
export const parseEntry = (input: unknown): string | string[] | Record<string, string> => {
    // If the prompt library ever gives us non-strings directly, pass them through
    if (Array.isArray(input)) {
        return (input as unknown[]).map(String)
    }
    if (input && typeof input === "object") {
        const out: Record<string, string> = {}
        for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
            if (typeof v === "string") out[String(k)] = v
        }
        return out
    }

    // Strings: try several strategies
    let s = String(input || "").trim()
    if (!s) return "src/index.ts"

    // 1) Quick comma-separated list → array
    // e.g. "src/index.ts, src/cli.ts"
    if (!s.startsWith("[") && !s.startsWith("{") && s.includes(",")) {
        const arr = s.split(",").map(x => x.trim()).filter(Boolean)
        if (arr.length > 1) return arr
    }

    // 2) Try strict JSON first
    try {
        const parsed = JSON.parse(s)
        return parseEntry(parsed)
    } catch {
    }

    // 3) Loosen to JSON5-ish:
    //    - replace single quotes with double quotes for string literals
    //    - quote bare keys in objects: { foo: "bar" } → { "foo": "bar" }
    // NOTE: These regexes are pragmatic, not a full JSON5 parser.
    let t = s

    // If it looks like an object/array literal, normalize it
    const looksLikeObjOrArr = /^[\[{][\s\S]*[\]}]$/.test(t)

    if (looksLikeObjOrArr) {
        // a) Quote bare keys: {foo: 'x', bar_baz: "y"} → {"foo": 'x', "bar_baz": "y"}
        t = t.replace(/([{,\s])([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')

        // b) Turn single-quoted strings into double-quoted
        //    'path/thing' → "path/thing"
        t = t.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) =>
            `"${inner.replace(/"/g, '\\"')}"`
        )

        try {
            const parsed = JSON.parse(t)
            return parseEntry(parsed)
        } catch {
            // fall through
        }
    }

    // 4) Fallback: treat as plain string path/glob
    return s
}

export const getDefaultAndExport = (entry: ValidEntry): DefaultAndExport => {
    if (entry.shape === 'Single') {
        return {default: entry.entry as string}
    }
    if (entry.shape === 'Client' || entry.shape === 'Server') {
        const exports: string[] = []

        const clientOutput = entry.shape === 'Client'
        for (const alias in entry.entry as ClientServerEntry) {
            if((clientOutput && alias === 'client') || (!clientOutput && alias === 'server')) continue
            exports.push(alias)
        }

        return {
            default: clientOutput ? 'client': 'server',
            exports
        }
    }

    let defaultItem: string | undefined

    const items = entry.entry as MultiEntry
    const isObject = !Array.isArray(items)
    const exports: string[] = []

    for (const key in items) {
        const path = isObject ? items[key] : items[Number(key)]
        const defaultWasSet = defaultItem !== undefined
        if (!defaultWasSet) {
            if (isObject && key === 'index') defaultItem = path
            if (isDefaultEntry(path)) defaultItem = path
        }
        const defaultIsNotSet = defaultItem === undefined
        if (defaultWasSet || defaultIsNotSet) { // push to export if was not set as default
            exports.push(isObject ? key : path)
        }
    }

    if (defaultItem === undefined) {
        // remove first item from exports and set it as default
        defaultItem = exports[0]
        exports.shift()
    }

    return {default: defaultItem, exports}
}

const filterValidItems = (entry: MultiEntry) => {
    const isObject: boolean = !Array.isArray(entry)
    const clientServer: boolean = isObject && isClientServer(entry)
    const validEntries = isObject ? {} as ObjectEntry : [] as string[]
    let empty = true
    for (const k in entry) {
        const path = !Array.isArray(entry) ? entry[k] : entry[Number(k)]
        if(clientServer && k === CLIENT_SERVER_DECIDER) continue
        if (isValidPath(path)) {
            empty = false
            Array.isArray(validEntries) ? validEntries.push(path) : validEntries[k] = path
        } else {
            const entry = isObject ? `${k} : "${path}"` : path
            if(clientServer && (k === 'client' || k === 'server')) {
                console.error(`Required entry ${entry} was not found. Can't continue without it.`)
                return null
            }
            else console.warn(`entry ${entry} was not found.`)
        }
    }
    return empty ? null : validEntries
}

const isClientShape = (entry: ClientServerEntry) => entry[CLIENT_SERVER_DECIDER] === undefined || entry[CLIENT_SERVER_DECIDER] !== 'node'

export const entryValidator = async (entry: EntryShape): Promise<ValidatedEntry> => {
    if (isString(entry)) {
        if (isStringEntry(entry)) return isValidPath(entry) ? {valid: true, entry, shape: 'Single'} : {valid: false}
        if (isGlob(entry)) {
            const files: string[] | null = await exportFilesFromGlob(entry)
            return files ? {valid: true, entry: files, shape: 'Array'} : {valid: false}
        }
    }
    const isObject = !Array.isArray(entry)
    const shape = isObject ? isClientServer(entry) ? isClientShape(entry) ? 'Client' : 'Server' : 'Object' : 'Array'
    console.log('Shape', shape)
    const validEntries = filterValidItems(entry)
    return validEntries ? {valid: true, entry: validEntries, shape} : {valid: false}
}