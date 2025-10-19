import {buildFormats} from "./build"
import {WizardConfig} from "../config"

export const buildArrayEntry = async (cfg: WizardConfig): Promise<boolean> => {
    const simpleExport = !cfg.formatDir
    await buildFormats(cfg, simpleExport)
    return simpleExport
}