import {ClientServer, EntryShape, MultiEntry, WizardConfig} from "./core"

const VALID_FORMATS = new Set(["esm", "cjs", "iife"])
const VALID_PLATFORMS = new Set(["node", "browser", "neutral"])
const VALID_MINIFY = new Set(["no", "iife", "all"])

/** Final shape with validation & sensible defaults */
export const sanitizeConfig = (raw: any): WizardConfig => {
    const entry = parseEntry(raw.entry)

    const formats = (Array.isArray(raw.formats) ? raw.formats :
        [raw.formats]).filter((f: any) => VALID_FORMATS.has(f)) as WizardConfig["formats"]
    const platform = VALID_PLATFORMS.has(raw.platform) ? raw.platform : "neutral"
    const minify = VALID_MINIFY.has(raw.minify) ? raw.minify : "iife"

    // Ensure outDir is a simple string
    const outDir = (typeof raw.outDir === "string" && raw.outDir.trim()) ? raw.outDir.trim() : "dist"

    return {
        entry,
        mergeInOne: !!raw.mergeInOne,
        outDir,
        formats: formats.length ? formats : ["esm", "cjs"],
        platform,
        dts: !!raw.dts,
        sourcemap: !!raw.sourcemap,
        minify,
        globalName: raw.globalName ? String(raw.globalName) : undefined,
        formatDir: !!raw.formatDir,
        clean: !!raw.clean,
        autoExport: !!raw.autoExport
    }
}

/** Turn the entry prompt (string/array/object-ish) into a real value */
const parseEntry = (input: unknown): string | string[] | Record<string, string> => {
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

export const isClientServer = (entry: any): entry is ClientServer => (typeof entry === "object" && entry.hasOwnProperty('client') && entry.hasOwnProperty('server'))

export const isGlob = (entry: EntryShape) => typeof entry === "string" && /[*?]/.test(entry)

export const isArrayOrObject = (entry: any): entry is MultiEntry => {
    if (Array.isArray(entry)) return entry.length > 1
    if (entry && typeof entry === "object") return Object.keys(entry).length > 1
    return false
}

export const isMultiEntry = (entry: any): boolean => {
    if (isArrayOrObject(entry)) return true
    return isGlob(entry)
}

export const canMerge = (entry: EntryShape) => isMultiEntry(entry) && !isClientServer(entry)