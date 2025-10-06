import fg from "fast-glob"
import fs from "node:fs"
import path from "node:path"

import {ClientServer, EntryShape, TEMP_IIF_ENTRY, TEMP_WIZARD_DIRECTORY, WizardConfig} from "./core"


const VALID_FORMATS = new Set(["esm","cjs","iife"])
const VALID_PLATFORMS = new Set(["node","browser","neutral"])
const VALID_MINIFY = new Set(["no","iife", "all"])

/** Turn the entry prompt (string/array/object-ish) into a real value */
function parseEntry(input: unknown): string | string[] | Record<string,string> {
    // If the prompt library ever gives us non-strings directly, pass them through
    if (Array.isArray(input)) {
        return (input as unknown[]).map(String)
    }
    if (input && typeof input === "object") {
        const out: Record<string,string> = {}
        for (const [k,v] of Object.entries(input as Record<string,unknown>)) {
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
    } catch {}

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

/** Final shape with validation & sensible defaults */
export function sanitizeConfig(raw: any): WizardConfig {
    const entry = parseEntry(raw.entry)

    const formats = (Array.isArray(raw.formats) ? raw.formats :
        [raw.formats]).filter((f: any) => VALID_FORMATS.has(f))as WizardConfig["formats"]
    const platform = VALID_PLATFORMS.has(raw.platform) ? raw.platform : "neutral"
    const minify = VALID_MINIFY.has(raw.minify) ? raw.minify : "iife"

    // Ensure outDir is a simple string
    const outDir = (typeof raw.outDir === "string" && raw.outDir.trim()) ? raw.outDir.trim() : "dist"

    return {
        entry,
        outDir,
        formats: formats.length ? formats : ["esm","cjs"],
        platform,
        dts: !!raw.dts,
        sourcemap: !!raw.sourcemap,
        minify,
        globalName: raw.globalName ? String(raw.globalName) : undefined,
        formatDir: !!raw.formatDir,
        clean: !!raw.clean,
    }
}

export const isClientServer = (entry: any): entry is ClientServer => (typeof entry === "object" && entry.hasOwnProperty('client') && entry.hasOwnProperty('server'))

const isGlob = (entry: string) => /[*?]/.test(entry)

export function isMultiEntry(entry: EntryShape): boolean {
    if (Array.isArray(entry)) return entry.length > 1
    if (entry && typeof entry === "object") return Object.keys(entry).length > 1
    return isGlob(entry)
}

/**
 * Expands a glob (like "src/**\/*.ts") into importable paths
 * and writes a temporary IIFE barrel file re-exporting them.
 * Returns the barrel path you can pass to tsdown.build().
 */
async function exportFilesFromGlob(globPattern: string) {
    const files = await fg(globPattern, {
        absolute: false,
        onlyFiles: true,
        ignore: ["**/*.d.ts", "**/*.test.ts", "**/__tests__/**"],
    })

    if (!files.length) {
        console.warn("⚠️  No files matched the glob pattern:", globPattern);
        return null
    }

    return files
}

export async function mergeMultipleEntries(entry: EntryShape) {
    const outDir = TEMP_WIZARD_DIRECTORY
    let items : Record<string, string> | string[] | null
    if (typeof entry === "string") {
        if(isGlob(entry)) {
            items = await exportFilesFromGlob(entry)
            if (items === null)
                return null
        }else {
            return null
        }
    } else {
        items = entry
    }

    const barrelDir = path.resolve(outDir)
    const barrelPath = path.join(barrelDir, TEMP_IIF_ENTRY)
    fs.mkdirSync(barrelDir, { recursive: true })

    const lines : string[] = []

    // Build re-exports like:
    // export * as entry1 from "../src/entry1.ts"
    // export * as utils_math from "../src/utils/math.ts"
    for(const f in items) {
        const minorPath = (Array.isArray(items)) ? items[Number(f)] : items[f]
        const rel = "./" + path.relative(barrelDir, minorPath).replace(/\\/g, "/")
        let alias = ''
        if(Array.isArray(items)) {
            const base = path.basename(minorPath, path.extname(minorPath))
            // turn "src/utils/math.ts" → "utils_math"
            alias = path
                .dirname(path.relative("src", minorPath))
                .split(path.sep)
                .filter(Boolean)
                .concat(base)
                .join("_")
                .replace(/[^\w$]/g, "_")
        } else {
            alias = f
        }

        lines.push(`export * as ${alias} from "${rel}";`)
    }

    const content =
        [
            "// Auto-generated IIFE barrel — do not edit",
            ...lines,
            "",
        ].join("\n")

    fs.writeFileSync(barrelPath, content, "utf8")
    return barrelPath
}



