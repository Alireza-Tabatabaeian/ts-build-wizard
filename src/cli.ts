#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import {execSync} from "node:child_process"
import prompts from "prompts"
import {build} from "tsdown"
import {CFG_FILE, TEMP_WIZARD_DIRECTORY, WIZARD_MESSAGES, WizardConfig} from "./core"
import {isClientServer, isMultiEntry, mergeMultipleEntries, sanitizeConfig} from "./tools";

const main = async () => {
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, "package.json")
    if (!fs.existsSync(pkgPath)) {
        console.error("No package.json found. Run `npm init -y` and try again.")
        process.exit(1)
    }

    // 0) If config exists, offer reuse
    let existing: WizardConfig | null = null
    if (fs.existsSync(CFG_FILE)) {
        try {
            existing = JSON.parse(fs.readFileSync(CFG_FILE, "utf8"))
            if (existing) {
                const {reuse} = await prompts({
                    type: "toggle",
                    name: "reuse",
                    message:
                        "Found an existing build config that outputs " +
                        `${existing.formats.join(", ")} for ${existing.platform} with sourcemap=${existing.sourcemap}. Reuse it?`,
                    initial: true,
                    active: "yes",
                    inactive: "no",
                })

                if (reuse) {
                    await ensureTsconfig()
                    await ensureDeps()
                    await runBuild(existing)
                    return
                }
            }
        } catch {
            console.warn(`Warning: ${CFG_FILE} exists but could not be parsed. Ignoring it.`);
        }
    }


    // 1) Explain choices & ask
    console.log(
        [
            "This wizard will set up tsdown builds.",
            "• ESM/CJS/IIFE decide the JS module format.",
            "• platform (node/browser/neutral) controls environment assumptions.",
            "• sourcemap helps debugging; can be disabled for leaner packages.",
            "• d.ts types are for TypeScript consumers.",
        ].join("\n")
    )

    // infer defaults

    let defaultEntry = inferEntry()
    const defaultOutDir = "dist"
    if (defaultEntry === null) {
        const {stop} = await prompts({
            type: "toggle",
            name: "stop",
            message: WIZARD_MESSAGES.entryFileMissing,
            initial: false,
            active: "Stop Build",
            inactive: "Continue",
        })
        if (stop) {
            console.log("The build process stopped. You can try again when you're ready.;)")
            process.exit(1)
        } else {
            defaultEntry = "src/**/*.ts"
        }
    }

    const answers = await prompts([

        {type: "text", name: "entry", message: WIZARD_MESSAGES.entryFile, initial: defaultEntry},
        {type: "text", name: "outDir", message: "Output directory", initial: defaultOutDir},

        {
            type: "multiselect",
            name: "formats",
            message: "Choose output formats (multiple choices is allowed)",
            instructions: false,
            choices: [
                {title: "ESM (for import)", value: "esm", selected: true},
                {title: "CJS (for require)", value: "cjs", selected: true},
                {title: "IIFE (global for browser/CDN)", value: "iife"},
            ],
            min: 1,
        },
        {
            type: (prev, values) => values.formats.length > 1 ? "toggle" : null,
            name: "formatDir",
            message: WIZARD_MESSAGES.separateFormats,
            initial: true,
            active: "Yes",
            inactive: "No",
        },
        {
            type: "select",
            name: "platform",
            message: WIZARD_MESSAGES.platform,
            instructions: false,
            choices: [
                {title: "Node (server)", value: "node", selected: true},
                {title: "Browser (client)", value: "browser"},
                {title: "Neutral (both)", value: "neutral"},
            ],
            min: 1,
        },
        {
            type: "toggle",
            name: "dts",
            message: WIZARD_MESSAGES.typeDeclaration,
            initial: true,
            active: "yes",
            inactive: "no",
        },
        {
            type: "toggle",
            name: "sourcemap",
            message: WIZARD_MESSAGES.sourcemap,
            initial: true,
            active: "yes",
            inactive: "no",
        },
        {
            type: "select",
            name: "minify",
            message: "Minify output (reduces both package size and code readability. recommended for browser/IIFE)?",
            instructions: false,
            choices: [
                {title: "No", value: "no"},
                {title: "Only IIFE", value: "iife", selected: true},
                {title: "Everything", value: "all"},
            ],
            min: 1,
        },
        {
            type: (prev, values) => values.formats.includes("iife") ? "text" : null,
            name: "globalName",
            message: "Global name for IIFE (e.g., MyLib)",
            initial: "MyLib",
        },
        {
            type: "toggle",
            name: "clean",
            message: WIZARD_MESSAGES.cleanOutput,
            initial: true,
            active: "yes",
            inactive: "no",
        },
        {
            type: "toggle",
            name: "autoExport",
            message: WIZARD_MESSAGES.autoExport,
            initial: false,
            active: "yes",
            inactive: "no",
        }
    ])

    ensureGitignore()

    const cfg: WizardConfig = sanitizeConfig(answers)

    // 2) Save config for future usages
    fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2) + "\n", "utf8")
    console.log(`Saved ${CFG_FILE}`)

    // 3) Ensure tsconfig.json
    await ensureTsconfig()

    // 4) Ensure deps (typescript + tsdown)
    await ensureDeps()

    console.log("Building with:", {
        entry: cfg.entry,
        formats: cfg.formats,
        formatDir: cfg.formatDir,
        platform: cfg.platform,
        dts: cfg.dts,
        sourcemap: cfg.sourcemap,
        minify: cfg.minify,
        outDir: cfg.outDir,
        clean: cfg.clean,
        autoExport: cfg.autoExport,
        ...(cfg.globalName ? {globalName: cfg.globalName} : {}),
    })

    // 5) Run initial build
    await runBuild(cfg)
}

function inferEntry() {
    const tryList = [
        "src/index.ts",
        "src/main.ts",
        "src/mod.ts",
        "lib/index.ts",
        "index.ts",
    ]
    for (const p of tryList) if (fs.existsSync(p)) return p
    return null
}

function ensureGitignore() {
    const p = ".gitignore"
    const needed = ["dist", CFG_FILE, TEMP_WIZARD_DIRECTORY]
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

async function ensureTsconfig() {
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

async function ensureDeps() {
    const pm = detectPackageManager()
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
    const have = (name: string) =>
        (pkg.dependencies && pkg.dependencies[name]) ||
        (pkg.devDependencies && pkg.devDependencies[name]);
    const need: Record<string, string> = {}
    if (!have("typescript")) need["typescript"] = "^5.9.3"
    if (!have("tsdown")) need["tsdown"] = "^0.15.0"
    if (Object.keys(need).length === 0) return

    console.log(`Installing: ${Object.keys(need).join(", ")} via ${pm} …`)
    const list = Object.entries(need).map(([n, v]) => `${n}@${v}`)
    const cmd =
        pm === "pnpm" ? `pnpm add -D ${list.join(" ")}` :
            pm === "yarn" ? `yarn add -D ${list.join(" ")}` :
                pm === "bun" ? `bun add -d ${list.join(" ")}` :
                    `npm i -D ${list.join(" ")}`
    execSync(cmd, {stdio: "inherit"})
}

async function runBuild(cfg: WizardConfig) {
    try {
        if (isMultiEntry(cfg.entry)){
            if(cfg.platform === 'neutral' && typeof cfg.entry === "object" && isClientServer(cfg.entry)) {
                const clientCFG :WizardConfig = {...cfg, entry: cfg.entry.client, platform:"browser" }
                await buildPackage(clientCFG)
                const serverCFG: WizardConfig = {...cfg, entry: cfg.entry.server, platform:"node", clean: false}
                await buildPackage(serverCFG)
            }
            else if (cfg.formats.includes("iife")) {
                cfg.formats.splice(cfg.formats.indexOf("iife"), 1)
                const moreFormats = cfg.formats.length > 0
                if (moreFormats) {
                    await buildPackage(cfg)
                }
                await mergeMultipleEntries(cfg.entry) // merge all files into iife.entry.ts and use it as file entry for iife
                const iifeCFG :WizardConfig = {
                    ...cfg,
                    formats: ["iife"],
                    clean: (cfg.clean && !moreFormats),
                    dts:(cfg.dts && !moreFormats)
                }
                await buildPackage(iifeCFG)
            }
            else {
                await buildPackage(cfg)
            }
        } else {
            await buildPackage(cfg)
        }
        console.log("Package was built successfully.")
    } catch (e) {
        console.error("Build failed:", e);
        process.exitCode = 1;
    }
}

async function buildPackage(cfg: WizardConfig) {
    for (let i = 0; i < (cfg.formatDir ? cfg.formats.length : 1); i++) {
        const format = cfg.formats[i]
        console.log(`Creating ${format}...`)
        await build({
            shims: cfg.platform !== "node",
            entry: cfg.entry,
            format,
            platform: cfg.platform,
            sourcemap: cfg.sourcemap,
            minify: (cfg.minify === 'all' || (cfg.minify === format)) ? true: false, // all or iife
            globalName: cfg.globalName,
            outDir: cfg.formatDir? `${cfg.outDir}/${format}` : cfg.outDir,
            dts: (cfg.clean && i == 0)? true : false,
            exports: cfg.autoExport,
            clean: (cfg.clean && i == 0)? true : false
        })
    }

}

function detectPackageManager(cwd = process.cwd()) {
    const p = (f: string) => fs.existsSync(path.join(cwd, f))
    if (p("pnpm-lock.yaml")) return "pnpm"
    if (p("yarn.lock")) return "yarn"
    if (p("bun.lockb")) return "bun"
    return "npm"
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
