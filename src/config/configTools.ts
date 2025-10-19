import fs from "node:fs"

import {parseEntry} from "../entry/entryTools"
import {WizardConfig} from "./WizardConfig"

export const CFG_FILE = "tsbuild.wizard.json"

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

export const readConfigFile = () : WizardConfig | null => {
    if (fs.existsSync(CFG_FILE)) {
        try {
            return  JSON.parse(fs.readFileSync(CFG_FILE, "utf8")) as WizardConfig
        }
        catch {
            console.warn(`Warning: ${CFG_FILE} exists but could not be parsed. Ignoring it.`)
        }
    }
    return null
}

export const configViewer = (config: WizardConfig, title: string = 'The config is:'):string => {
    return [
        title,
        `\tFile Entry: ${config.entry}`,
        `\tOutput Directory: ${config.outDir}`,
        `\tFormats : ${config.formats.join(", ")}`,
        `\tPlatform: ${config.platform}`,
        `\tType Declaration: ${config.dts ? 'True' : 'False'}`,
        `\tGenerate Source Maps: ${config.sourcemap ? 'True' : 'False'}`,
        `\tSeparate format outputs: ${config.formatDir? 'True' : 'False'}`,
        `\tAuto Export: ${config.autoExport ? 'True' : 'False'}`,
    ].join('\n')
}

export const saveConfig = (config: WizardConfig) => {
    fs.writeFileSync(CFG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8")
    console.log(`Saved ${CFG_FILE}`)
}