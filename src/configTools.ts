import {CFG_FILE, WizardConfig} from "./core"
import fs from "node:fs"

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