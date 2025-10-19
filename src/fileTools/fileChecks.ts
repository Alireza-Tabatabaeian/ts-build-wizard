import path from "node:path"
import fs from "node:fs"

import {isGlob} from "../entry/entryCheck"

export const isValidPath = (entry: any): entry is string => {
    if (typeof entry !== "string") return false
    const trimmed = entry.trim()
    if (trimmed.length === 0) return false
    if (isGlob(trimmed)) return false
    return fs.existsSync(path.resolve(trimmed))
}