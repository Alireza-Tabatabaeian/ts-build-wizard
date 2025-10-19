import fs from "node:fs"
import fg from "fast-glob"
import path from "node:path"

import {rimraf} from "rimraf"

import {CANDIDATE_ENTRIES, EntryShape} from "../entry"
import {isStringEntry} from "../entry/entryCheck"
import {FileParts} from "../core"

export const CWD = process.cwd()

const GLOB_IGNORE_LIST = ["**/*.d.ts", "**/*.test.ts", "**/__tests__/**", "**/node_modules/**"] // type declarations and tests should be excluded

export const clearPath = async (pathAddress: string) => {
    await rimraf(path.join(CWD, pathAddress))
}

export const directoryParts = (filePath: string): string[] => {
    return path.dirname(path.relative('.', filePath)).split(path.sep).filter(Boolean)
}

export const findSourceDir = (entries: EntryShape) => {
    if(isStringEntry(entries)) return directoryParts(entries).join('/')

    const filePaths = Array.isArray(entries) ? entries : Object.values(entries)

    const firstEntry = filePaths[0]

    if (firstEntry === undefined) return '.'

    let commonPath: string[] = directoryParts(firstEntry)
    if (commonPath.length === 1 && commonPath[0] === '.')
        return '.'

    for (let file_index = 1; file_index < filePaths.length; file_index++) {
        const file = filePaths[file_index]
        const parts = directoryParts(file)
        for (let i = 0; i < commonPath.length; i++) {
            if (commonPath[i] !== parts[i]) {
                if (i === 0) return '.'
                commonPath = commonPath.slice(0, i)
                break
            }
        }
    }
    return commonPath.join('/')
}

export const fileRelativeParts = (
    stringPath: string,
    sourcePath: string,
): FileParts => {
    const ext = path.extname(stringPath)
    const base = path.basename(stringPath, ext)
    if((base + ext) === stringPath) return new FileParts([], base) // if no relative directory exist
    const relativeParts = path
        .dirname(path.relative(sourcePath, stringPath))
        .split(path.sep)
        .filter(Boolean)
    if (relativeParts[0] && relativeParts[0] === '.')
        relativeParts.shift() // '.' or 'src' or similar path skipped
    return new FileParts(relativeParts, base)
}

export const inferEntry = (): string | null => {
    for (const p of CANDIDATE_ENTRIES) if (fs.existsSync(p)) return p
    return null
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