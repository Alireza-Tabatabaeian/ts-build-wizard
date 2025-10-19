import path from "node:path"
import fs from "node:fs"

import {CWD} from "./fileTools"
import {TEMP_WIZARD_DIRECTORY} from "./mergeFiles"
import {BACKUP_DIRECTORY} from "./distBackup"


export const packageJsonExist = (): boolean => {
    const pkgPath = path.join(CWD, "package.json")
    return fs.existsSync(pkgPath)
}

export const ensureGitignore = () => {
    const p = ".gitignore"
    const needed = ["dist", "node_modules", TEMP_WIZARD_DIRECTORY, BACKUP_DIRECTORY]
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