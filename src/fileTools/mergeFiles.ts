import path from "node:path"
import fs from "node:fs"

import {fileRelativeParts} from "./fileTools"
import {MultiEntry} from "../entry"

export const TEMP_WIZARD_DIRECTORY = ".tmp-wizard"
export const MERGED_ENTRY = "merged.entry.ts"

export const mergeMultipleEntries = async (entry: MultiEntry, sourceDir: string, iife: boolean = false): Promise<string> => {
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
        const fileParts = fileRelativeParts(minorPath, sourceDir)
        let alias: string | null = (
            isArray ?
                (
                    iife ?
                        fileParts.toAlias(true).replace(/[^\w$]/g, "_") :
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
    return barrelPath.replace(/\\/g, '/')
}