import {findPackage, readPackageJSON, writePackage} from "pkg-types"
import {WizardConfig} from "../config"
import {DefaultAndExport} from "../entry"
import {fileRelativeParts, isValidPath} from "../fileTools"


type ExportInfo = {
    import?: string,
    require?: string,
    types?: string,
    default?: string
}

export const alterPackageJson = async (defaultAndExports: DefaultAndExport, sourceDir: string, cfg: WizardConfig ) => {

    const filename = await findPackage()
    const pkg = await readPackageJSON(filename)
    const esmPackage = pkg.type === "module"

    const containsESM = cfg.formats.includes("esm")
    const containsCJS = cfg.formats.includes("cjs")

    const defaultESM: boolean = containsESM && (esmPackage || (!esmPackage && !containsCJS))
    const needsMain: boolean = containsESM || containsCJS
    if (!needsMain)
        return // no esm or cjs format included

    const otherExports: Record<string, ExportInfo> = {}

    if (!defaultAndExports.default) {
        console.log("Default entry not set!!!")
        return
    }

    const defaultFileName = fileRelativeParts(defaultAndExports.default,sourceDir).baseFileName
    const paths: ExportInfo = outputFormatPath(defaultFileName, cfg.formatDir === true, cfg.outDir, defaultESM)

    if (paths.default === undefined) {
        console.warn("default files not found. unable to modify package.json automatically")
        return
    }

    pkg.main = paths.default
    if (paths.import) pkg.module = paths.import
    if (paths.types) pkg.types = paths.types

    for(const exportItem of defaultAndExports.exports ?? []) {
        const fileParts = fileRelativeParts(exportItem,sourceDir)
        otherExports[`./${fileParts.toAlias()}`] = outputFormatPath(fileParts.toPath(),cfg.formatDir === true, cfg.outDir, defaultESM)
    }

    pkg.exports = {
        '.': paths,
        ...otherExports,
        './package.json': './package.json'
    }

    if (!Array.isArray(pkg.files)) pkg.files = []
    if (!pkg.files?.includes(cfg.outDir)) pkg.files?.push(cfg.outDir)

    await writePackage(filename, pkg)
}

const outputFormatPath = (
    fileName: string,
    formatDir: boolean,
    outDir: string,
    defaultESM: boolean
): ExportInfo => {
    const esmPath = formatDir ? `./${outDir}/esm/${fileName}.mjs` : `./${outDir}/${fileName}.mjs`
    const cjsPath = formatDir ? `./${outDir}/cjs/${fileName}.cjs` : `./${outDir}/${fileName}.cjs`
    const esmDeclare = formatDir ? `./${outDir}/esm/${fileName}.d.mts` : `./${outDir}/${fileName}.d.mts`
    const cjsDeclare = formatDir ? `./${outDir}/cjs/${fileName}.d.cts` : `./${outDir}/${fileName}.d.cts`
    const validEsm = isValidPath(esmPath)
    const validCjs = isValidPath(cjsPath)
    const validEsmDeclare = isValidPath(esmDeclare)
    const validCjsDeclare = isValidPath(cjsDeclare)

    const result: ExportInfo = {}

    if (validEsm) result.import = esmPath
    if (validCjs) result.require = cjsPath
    if (validEsmDeclare || validCjsDeclare) result.types = validEsmDeclare ? esmDeclare : cjsDeclare
    result.default = defaultESM ? (validEsm ? esmPath : undefined) : validCjs ? cjsPath : undefined

    return result
}