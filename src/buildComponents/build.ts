import prompts from "prompts"
import {build, UserConfig} from "tsdown"

import {alterPackageJson} from "./packageJsonTools"
import {entryValidator, getDefaultAndExport} from "../entry/entryTools"
import {buildSingleEntry} from "./buildSingleEntry"
import {buildArrayEntry} from "./buildArrayEntry"
import {buildRecordEntry} from "./buildRecordEntry"
import {WizardConfig} from "../config"
import {clearPath, findSourceDir, mergeMultipleEntries, createDistBackup} from "../fileTools"
import {MultiEntry} from "../entry"


const REQUIRED_OPTIONS: Partial<UserConfig> = {clean: false}

export const runBuild = async (cfg: WizardConfig) => {

    const validEntry = await entryValidator(cfg.entry)
    if (!validEntry.valid) {
        console.log("No valid files were found to build.")
        return
    }

    // 1) Clean outDir if is requested
    if (cfg.clean) {
        const backupCreated = await createDistBackup(cfg.outDir)
        if (!backupCreated) {
            const {continueWithoutBackup} = await prompts({
                type: "toggle",
                name: "continueWithoutBackup",
                message: [
                    'Backup current output',
                    `The app couldn't copy your current output directory (${cfg.outDir})`,
                    'Do you want to continue without a backup?'
                ].join('\n'),
                initial: true,
                active: "Stop Build",
                inactive: "Continue",
            })
            if (continueWithoutBackup) {
                console.log("The build process stopped. You can try again when you're ready.;)")
                process.exit(1)
            }
        }
        await clearPath(cfg.outDir)
    }

    const sourceDir: string = findSourceDir(validEntry.entry)
    let simpleBuild: boolean = true

    if (validEntry.shape === 'Array' || validEntry.shape === 'Object') {
        if (cfg.mergeInOne || cfg.formats.includes('iife')) {
            const mergePath = await mergeMultipleEntries(validEntry.entry as MultiEntry, sourceDir)
            if (cfg.mergeInOne) {
                // build everything only from this file
                cfg.entry = mergePath
                simpleBuild = await buildSingleEntry(cfg)
                console.log('Build successfully.')
                if (!simpleBuild) {
                    const defaultAndExports = getDefaultAndExport({valid:true, entry:mergePath, shape:'Single'})
                    await alterPackageJson(defaultAndExports, sourceDir, cfg)
                    console.log('Altering package.json finished.')
                }
                return
            }
            else {
                const iifeConfig: WizardConfig = {...cfg, entry:mergePath, formats: ['iife']}
                await buildSingleEntry(iifeConfig)
                cfg.formats.splice(cfg.formats.indexOf('iife'), 1)
                if (cfg.formats.length === 0) {
                    console.log("IIFE build successfully.")
                    return
                }
            }
        }
    }

    switch (validEntry.shape) {
        case "Single":
        case "Array":
            cfg.entry = validEntry.entry as string | string[]
            simpleBuild = await buildArrayEntry(cfg)
            break
        case "Object":
        case "Client":
        case "Server":
            simpleBuild = await buildRecordEntry(validEntry, cfg)
            break
    }

    if (!simpleBuild) {
        const defaultAndExports = getDefaultAndExport(validEntry)
        await alterPackageJson(defaultAndExports, sourceDir, cfg)
        console.log('Altering package.json finished.')
    }

    console.log("Package was built successfully.")
}


export const buildFormats = async (cfg: WizardConfig, simpleBuild: boolean) => {
    const userOptions: UserConfig = {
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
            userOptions.dts = cfg.dts
            userOptions.outDir = `${cfg.outDir}/${format}`
            userOptions.minify = cfg.minify === 'all' || cfg.minify === format
            const buildSuccessful: boolean = await buildByTsdown(userOptions)
            console.log(buildSuccessful ? `successfully built ${format} for ${cfg.entry} .` : `failed to build ${format} for ${cfg.entry}`)
        }
    } else {
        const buildSuccessful = await buildByTsdown(userOptions)
        console.log(buildSuccessful ? `${cfg.entry} built successfully.` : `failed to build ${cfg.entry}`)
    }
}

const buildByTsdown = async (userOptions: Partial<UserConfig>) => {
    const options = {...userOptions, ...REQUIRED_OPTIONS}
    try {
        await build(options)
        return true
    } catch (err) {
        console.error(err)
        return false
    }
}