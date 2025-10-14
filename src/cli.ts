#!/usr/bin/env node
import prompts from "prompts"

import {WIZARD_MESSAGES, WizardConfig} from "./core"
import {canMerge, sanitizeConfig} from "./tools"
import {runBuild} from "./build"
import {
    ensureGitignore,
    ensureTsconfig,
    inferEntry,
    packageJsonExist
} from "./fileTools"
import {ensureDeps} from "./dependencyHandler"
import {configViewer, readConfigFile, saveConfig} from "./configTools"

const main = async () => {
    if (!packageJsonExist()) {
        console.error("No package.json found. Run `npm init -y` and try again.")
        process.exit(1)
    }

    // 0) If config exists, offer reuse
    let existing = readConfigFile()
    if (existing) {
        const {reuse} = await prompts({
            type: "toggle",
            name: "reuse",
            message: [
                "Found an existing build config:",
                configViewer(existing),
                "\nDo you want to use the following config again?"
            ].join('\n'),
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
        // Entry File(s)
        {
            type: "text",
            name: "entry",
            message: WIZARD_MESSAGES.entryFile,
            initial: defaultEntry
        },
        // Merge Multiple
        {
            type: (prev, values) => canMerge(values.entry) ? "toggle" : null,
            name: "mergeInOne",
            message: WIZARD_MESSAGES.merge,
            initial: true,
            active: "Merge",
            inactive: "Don't Merge",
        },
        // Output directory
        {
            type: "text",
            name: "outDir",
            message: "Output directory",
            initial: defaultOutDir
        },
        // Formats
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
        // Separate output based on formats
        {
            type: (prev, values) => values.formats.length > 1 ? "toggle" : null,
            name: "formatDir",
            message: WIZARD_MESSAGES.separateFormats,
            initial: true,
            active: "Yes",
            inactive: "No",
        },
        // Platform
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
        // Type Declarations
        {
            type: "toggle",
            name: "dts",
            message: WIZARD_MESSAGES.typeDeclaration,
            initial: true,
            active: "yes",
            inactive: "no",
        },
        // SourceMaps
        {
            type: "toggle",
            name: "sourcemap",
            message: WIZARD_MESSAGES.sourcemap,
            initial: true,
            active: "yes",
            inactive: "no",
        },
        // Minify Code
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
        // Global Name for IIFE
        {
            type: (prev, values) => values.formats.includes("iife") ? "text" : null,
            name: "globalName",
            message: "Global name for IIFE (e.g., MyLib)",
            initial: "MyLib",
        },
        // Cleaning Output Dir
        {
            type: "toggle",
            name: "clean",
            message: WIZARD_MESSAGES.cleanOutput,
            initial: true,
            active: "yes",
            inactive: "no",
        },
        // AutoExport to package.json
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
    saveConfig(cfg)

    // 3) Ensure tsconfig.json
    await ensureTsconfig()

    // 4) Ensure deps (typescript + tsdown)
    await ensureDeps()

    console.log(configViewer(cfg, "Building with"))

    // 5) Run initial build
    await runBuild(cfg)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
