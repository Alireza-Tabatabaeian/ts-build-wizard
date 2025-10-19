import {WizardConfig} from "../config"

import {ClientServerEntry, ObjectEntry, ValidEntry} from "../entry"
import {isClientServer} from "../entry/entryCheck"
import {buildFormats} from "./build"
import {findSourceDir, mergeMultipleEntries} from "../fileTools";

export const buildRecordEntry = async (validEntry: ValidEntry, cfg: WizardConfig): Promise<boolean> => {
    const entry = validEntry.entry as ObjectEntry
    if(isClientServer(entry)) {
        const clientEntries: Partial<ClientServerEntry> = validEntry.shape === 'Client' ? {...entry} : {client: entry.client}
        delete clientEntries.server
        const serverEntries: Partial<ClientServerEntry> = validEntry.shape === 'Server' ? {...entry} : {server: entry.server}
        delete serverEntries.client
        const serverFormats = [...cfg.formats]
        if(serverFormats.includes('iife')) {
            serverFormats.splice(serverFormats.indexOf('iife'), 1)
            if(Object.entries(clientEntries).length > 1) {
                const iifeEntries = clientEntries as Record<string, string>
                const mergedPath = await mergeMultipleEntries(clientEntries as Record<string, string>,findSourceDir(iifeEntries),true)
                const iifeCFG: WizardConfig = {...cfg, entry: mergedPath, platform: "browser", formats:['iife']}
                await buildFormats(iifeCFG, false)
                cfg.formats = serverFormats
            }
        }

        const clientCFG : WizardConfig = {...cfg, entry: clientEntries as Record<string, string>, platform: 'browser'}
        const serverCFG : WizardConfig = {...cfg, entry: serverEntries as Record<string, string>, platform: 'node', formats: serverFormats}
        await buildFormats(clientCFG, false)
        await buildFormats(serverCFG, false)

        return false
    }
    const simpleExport = !cfg.formatDir
    cfg.entry = entry
    await buildFormats(cfg, simpleExport)
    return simpleExport
}