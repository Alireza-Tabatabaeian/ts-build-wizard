import {findPackage, readPackageJSON, writePackage} from "pkg-types"

import {WizardConfig} from "./core"

import {getDefaultEntry, isValidPath, stringToPathParts} from "./fileTools"
import {isClientServer} from "./tools";

type ExportInfo = {
    import?: string,
    require?: string,
    types?: string,
    default?: string
}

export const alterPackageJson = async (cfg: WizardConfig) => {
    const filename = await findPackage()
    const pkg = await readPackageJSON(filename)
    const esmPackage = pkg.type === "module"

    const containsESM = cfg.formats.includes("esm")
    const containsCJS = cfg.formats.includes("cjs")

    const defaultESM : boolean = containsESM && (esmPackage || (!esmPackage && !containsCJS))
    const needsMain : boolean = containsESM || containsCJS

    if(!needsMain)
        return // no esm or cjs format included

    const otherExports: Record<string, ExportInfo> = {}

    let defaultEntry: string | null

    if(typeof cfg.entry === "string") { // single entry
        defaultEntry = cfg.entry
    } else {
        if(isClientServer(cfg.entry)) {
            defaultEntry = cfg.entry.client
            const route = stringToPathParts(cfg.entry.server).join('/').replace(/\\/g, '/')
            otherExports[`./${route}`] = outputFormatPath(cfg.entry.server,cfg.formatDir === true,cfg.outDir,defaultESM)
        } else {
            defaultEntry = getDefaultEntry(cfg.entry)
            if(!defaultEntry) defaultEntry = Array.isArray(cfg.entry) ? cfg.entry[0] : Object.values(cfg.entry)[0]
            const length = Array.isArray(cfg.entry) ? cfg.entry.length : Object.keys(cfg.entry).length
            for (let i=1; i < length; i++) {
                const path: string = Array.isArray(cfg.entry) ? cfg.entry[i] : cfg.entry[Object.keys(cfg.entry)[i]]
                const route = stringToPathParts(path).join('/').replace(/\\/g, '/')
                otherExports[`./${route}`] = outputFormatPath(path, cfg.formatDir === true, cfg.outDir, defaultESM)
            }
        }
    }

    const paths: ExportInfo = outputFormatPath(defaultEntry,cfg.formatDir === true,cfg.outDir, defaultESM)

    if(paths.default === undefined) {
        console.warn("default files not found. unable to modify package.json automatically")
        return
    }

    pkg.main = paths.default
    if(paths.import) pkg.module = paths.import
    if(paths.types) pkg.types = paths.types

    pkg.exports = {
        '.': paths,
        ...otherExports,
        './package.json': './package.json'
    }

    if (!Array.isArray(pkg.files)) pkg.files = []
    if(!pkg.files?.includes(cfg.outDir)) pkg.files?.push(cfg.outDir)

    await writePackage(filename,pkg)
}

const outputFormatPath = (entry: string, formatDir: boolean, outDir: string, defaultESM: boolean) : ExportInfo => {
    const pathParts = stringToPathParts(entry)
    const fileName = pathParts.join("/").replace(/\\/g, '/').replace(/\.\//, '')
    const esmPath = formatDir ? `./${outDir}/esm/${fileName}.mjs` : `./${outDir}/${fileName}.mjs`
    const cjsPath = formatDir ? `./${outDir}/cjs/${fileName}.cjs` : `./${outDir}/${fileName}.cjs`
    const esmDeclare = formatDir ? `./${outDir}/esm/${fileName}.d.mts` : `./${outDir}/${fileName}.d.mts`
    const cjsDeclare = formatDir ? `./${outDir}/cjs/${fileName}.d.cts` : `./${outDir}/${fileName}.d.cts`
    const validEsm = isValidPath(esmPath)
    const validCjs = isValidPath(cjsPath)
    const validEsmDeclare = isValidPath(esmDeclare)
    const validCjsDeclare = isValidPath(cjsDeclare)

    const result : ExportInfo = {}

    if(validEsm) result.import = esmPath
    if(validCjs) result.require = cjsPath
    if(validEsmDeclare || validCjsDeclare) result.types = validEsmDeclare ? esmDeclare : cjsDeclare
    result.default = defaultESM ? (validEsm ? esmPath : undefined) : validCjs ? cjsPath : undefined

    return result
}