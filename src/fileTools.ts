import fs from "node:fs"
import fg from "fast-glob"
import path from "node:path"

import {MERGED_ENTRY, TEMP_WIZARD_DIRECTORY} from "./core"
import {isGlob} from "./tools"
import {rimraf} from "rimraf";

export const CWD = process.cwd()
const GLOB_IGNORE_LIST = ["**/*.d.ts", "**/*.test.ts", "**/__tests__/**"] // type declarations and tests should be excluded
const defaultEntryTryList = [
    "src/index.ts",
    "src/main.ts",
    "src/mod.ts",
    "lib/index.ts",
    "index.ts",
]

export const clearPath = async (pathAddress: string) => {
    await rimraf(path.join(CWD, pathAddress))
}

export const packageJsonExist = (): boolean => {
    const pkgPath = path.join(CWD, "package.json")
    return fs.existsSync(pkgPath)
}

export const isValidPath = (entry: any): entry is string => {
    if (typeof entry !== "string") return false
    const trimmed = entry.trim()
    if (trimmed.length === 0) return false
    if (isGlob(trimmed)) return false
    const pathTemp = path.resolve(path.join(CWD,trimmed))
    const exist = fs.existsSync(pathTemp)
    if(!exist) {
        console.log(trimmed)
        console.log(pathTemp)
    }
    return fs.existsSync(path.resolve(trimmed))
}

const isDefaultEntry = (path: string): boolean => {
    return isValidPath(path) && defaultEntryTryList.includes(path)
}

export const getDefaultEntry = (entry: string[] | Record<string, string>) => {
    for (const k in entry) {
        const path = Array.isArray(entry) ? entry[Number(k)] : entry[k]
        if (isDefaultEntry(path)) return path
    }
    return null
}

export const stringToPathParts = (stringPath: string): string[] => {
    const base = path.basename(stringPath, path.extname(stringPath))
    return path
        .dirname(path.relative("src", stringPath))
        .split(path.sep)
        .filter(Boolean)
        .concat(base)
}

export const inferEntry = (): string | null => {
    for (const p of defaultEntryTryList) if (fs.existsSync(p)) return p
    return null
}

export const ensureGitignore = () => {
    const p = ".gitignore"
    const needed = ["dist", "node_modules", TEMP_WIZARD_DIRECTORY]
    let text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""
    let changed = false
    for (const n of needed) {
        if (!text.split("\n").some(l => l.trim() === n)) {
            text += (text.endsWith("\n") ? "" : "\n") + n + "\n"
            changed = true
        }
    }
    if (changed) fs.writeFileSync(p, text, "utf8")
}

export const ensureTsconfig = async () => {
    if (fs.existsSync("tsconfig.json")) return
    const base = {
        compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "bundler",
            strict: true,
            esModuleInterop: true,
            resolveJsonModule: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true
        },
        include: ["src"]
    }
    fs.writeFileSync("tsconfig.json", JSON.stringify(base, null, 2) + "\n", "utf8")
    console.log("Created tsconfig.json")
}

/**
 * Expands a glob (like "src/**\/*.ts") into importable file paths
 */
export const exportFilesFromGlob = async (globPattern: string): Promise<string[] | null> => {
    const files = await fg(globPattern, {
        absolute: false,
        onlyFiles: true,
        ignore: GLOB_IGNORE_LIST,
    })

    if (!files.length) {
        console.warn("⚠️  No files matched the glob pattern:", globPattern)
        return null
    }

    return files
}

export const mergeMultipleEntries = async (entry: Record<string, string> | string[], iife: boolean = false): Promise<string> => {
    const outDir = TEMP_WIZARD_DIRECTORY
    const isArray = Array.isArray(entry)
    const barrelDir = path.resolve(outDir)
    const barrelPath = path.join(barrelDir, MERGED_ENTRY)
    fs.mkdirSync(barrelDir, {recursive: true})

    const lines: string[] = []

    // Build re-exports like:
    // export * as entry1 from "../src/entry1.ts"
    // export * as utils_math from "../src/utils/math.ts"
    for (const f in entry) {
        const minorPath = isArray ? entry[Number(f)] : entry[f]
        const rel = "./" + path.relative(barrelDir, minorPath).replace(/\\/g, "/")
        let alias: string | null = (
            isArray ?
                (
                    iife ?
                        stringToPathParts(minorPath).join("_").replace(/[^\w$]/g, "_") :
                        null
                ) :
                f
        )

        lines.push(`export *${alias ? " as " + alias : ''} from "${rel}";`)
    }

    const content =
        [
            "// Auto-generated barrel by 'ts-build-wizard' — do not edit",
            ...lines,
            "",
        ].join("\n")

    fs.writeFileSync(barrelPath, content, "utf8")
    console.log("BarrelPath:", barrelPath)
    return barrelPath
}
