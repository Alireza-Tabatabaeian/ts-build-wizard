import {MERGED_ENTRY, MultiEntry, TEMP_WIZARD_DIRECTORY, WizardConfig} from "./core"
import {isClientServer, isGlob, isMultiEntry} from "./tools"
import {build, Options} from "tsdown"
import {clearPath, exportFilesFromGlob, isValidPath, mergeMultipleEntries} from "./fileTools"
import {alterPackageJson} from "./packageJsonTools"


const REQUIRED_OPTIONS: Partial<Options> = {clean:false,fixedExtension:true}

export const runBuild = async (cfg: WizardConfig) => {
    let simpleBuild = !cfg.formatDir

    const isRecordEntry = typeof cfg.entry === "object"

    // 1) Clean outDir if is requested
    if (cfg.clean) {
        await clearPath(cfg.outDir)
    }
    // 2) Process multi entries
    if (isMultiEntry(cfg.entry)) {
        let validEntries : string[] | Record<string, string> = isRecordEntry ? {} : []

        if (isGlob(cfg.entry)) {
            // convert glob to list of files, skip tests and type declaration files to be involved
            const files = await exportFilesFromGlob(cfg.entry as string)
            if (files === null) {
                return
            }
            // glob has changed to list of file paths so the cfg.entry is not a single string anymore
            validEntries = files
        }
        else {
            const entries : string[] | Record<string, string> = cfg.entry as MultiEntry
            // check if the given entries really exist
            for (const key in entries) {
                const path : string = Array.isArray(entries) ? entries[Number(key)] : entries[key]
                if(isValidPath(path)) {
                    if(Array.isArray(validEntries)) validEntries.push(path)
                    else validEntries[key] = path
                }
                else console.warn(`path "${path}" is not a valid entry`)
            }
            const isEmpty =
                Array.isArray(validEntries) ? validEntries.length === 0 :
                    Object.keys(validEntries).length === 0;
            if(isEmpty) {
                console.log("No valid path found.")
                return
            }
        }
        // set cfg.entry to valid entries
        cfg.entry = validEntries as MultiEntry
        if (cfg.platform === 'neutral' && isClientServer(cfg.entry)) {
            simpleBuild = false
            const clientCFG: WizardConfig = {
                ...cfg,
                entry: cfg.entry.client,
                platform: "browser",
            }
            await buildFormats(clientCFG, simpleBuild)
            const serverCFG: WizardConfig = {
                ...cfg,
                entry: cfg.entry.server,
                platform: "node",
            }
            await buildFormats(serverCFG, simpleBuild)
        }
        else if (cfg.formats.includes("iife") || cfg.mergeInOne) {
            const mergedEntry = await mergeMultipleEntries(cfg.entry) // merge all files into merged.entry.ts
            console.log("Merged Entry", mergedEntry)
            if (!cfg.mergeInOne) { // use merged only for "iife"
                cfg.formats.splice(cfg.formats.indexOf("iife"), 1) // remove "iife" from formats
                const moreFormats = cfg.formats.length > 0
                if (moreFormats) { // if other formats than iife is requested build them regularly
                    await buildFormats(cfg, simpleBuild)
                }
                // now build iife from merged.entry
                const iifeCFG: WizardConfig = {
                    ...cfg,
                    entry: `${TEMP_WIZARD_DIRECTORY}/${MERGED_ENTRY}`,
                    formats: ["iife"],
                    dts: (cfg.dts && !moreFormats),
                    formatDir: true
                }
                await buildFormats(iifeCFG, simpleBuild)
            }
            else {
                cfg.entry = mergedEntry
                await buildFormats(cfg, simpleBuild)
            }
        }
        else { // no merge or iife build requests
            await buildFormats(cfg, simpleBuild)
        }
    }
    else { // single string entry
        await buildFormats(cfg, simpleBuild)
    }
    if (cfg.autoExport && !simpleBuild) {
        await alterPackageJson(cfg)
    }
    console.log("Package was built successfully.")
}


const buildFormats = async (cfg: WizardConfig, simpleBuild: boolean) => {
    const userOptions : Options = {
        entry: cfg.entry,
        platform: cfg.platform,
        format: cfg.formats,
        dts: cfg.dts,
        minify: cfg.minify === 'all',
        outDir: cfg.outDir,
        sourcemap: cfg.sourcemap,
        exports: simpleBuild,
        globalName: cfg.globalName
    }
    if (cfg.formatDir) {
        for (let i = 0; i < (cfg.formatDir ? cfg.formats.length : 1); i++) {
            const format = cfg.formats[i]
            console.log(`Creating ${format} for ${cfg.entry} ...`)
            userOptions.format = format
            userOptions.dts = cfg.dts && i === 0
            userOptions.outDir = `${cfg.outDir}/${format}`
            userOptions.minify = cfg.minify === 'all' || cfg.minify === format
            const buildSuccessful = await buildByTsdown(userOptions)
            console.log(buildSuccessful ? `successfully built ${format} for ${cfg.entry} .` : `failed to build ${format} for ${cfg.entry}`)
        }
    } else {
        const buildSuccessful = await buildByTsdown(userOptions)
        console.log(buildSuccessful? `${cfg.entry} built successfully.` : `failed to build ${cfg.entry}`)
    }

}

const buildByTsdown = async (userOptions: Partial<Options>) => {
    const options = {...userOptions,...REQUIRED_OPTIONS}
    try {
        await build(options)
        return true
    } catch (err) {
        console.error(err)
        return false
    }
}