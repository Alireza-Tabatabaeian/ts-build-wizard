export type ClientServer = { client:string, server:string }

export type EntryShape = string | string[] | Record<string, string> | ClientServer

export type MultiEntry = string[] | Record<string, string> | ClientServer

export type WizardConfig = {
    entry: EntryShape
    mergeInOne?: boolean
    outDir: string
    formats: ("esm" | "cjs" | "iife")[]
    platform: "node" | "browser" | "neutral"
    dts: boolean
    sourcemap: boolean
    minify: ("no" | "iife" | "all")
    clean: boolean
    autoExport: boolean
    formatDir?: boolean // e.g. dist/esm
    globalName?: string // for iife
}

export const CFG_FILE = "tsbuild.wizard.json"
export const TEMP_WIZARD_DIRECTORY = ".tmp-wizard"
export const MERGED_ENTRY = "merged.entry.ts"

export const WIZARD_MESSAGES = {
    entryFileMissing: [
        "Entry file:",
        "This is the module entry (or entries) TypeScript should start from.",
        "If another file (e.g., tools.ts) is only imported by your entry (e.g., index.ts),",
        "you do NOT need to list it here.",
        "",
        "Common defaults like `src/index.ts` or `index.ts` were not found.",
        "",
        "You can still continue and provide an entry path manually,",
        "or stop now and create `src/index.ts` first.",
    ].join("\n"),
    entryFile: [
        "Entry file path",
        "You can use:",
        "• 'src/index.ts' (single string)",
        "• 'src/index.ts','src/cli.ts' (multiple strings, separated by ',')",
        "• { index: 'src/main.ts' } (object; output becomes 'index.[ext]')",
        "• 'src/**/*.ts' (glob) — only if your tool supports glob entries",
        "",
        "Enter your desired entry:",
    ].join("\n"),
    merge: [
        "Merge into single entry:",
        "Since you have multiple entries, output package will have multiple routes.",
        "As a result the user can't import/require all features directly and should code something like:",
        "\t```import {FEATURE} from 'PACKAGE_NAME/TOOLS'\n\tFEATURE.use()```",
        "If merged then the code changes to:",
        "\t```import {FEATURE} from 'PACKAGE_NAME'\n\tFEATURE.use()```",
        "",
        "Do you want all entries to be merged into a single entry automatically?",
    ].join("\n"),
    platform: [
        "Platform",
        "Choose the target environment:",
        "• Node: Node.js runtime (and most Node-compatible runtimes like Bun).",
        "  Pick this if you use Node built-ins (fs, path, etc.).",
        "• Browser: Web browsers. Good for front-end/CDN builds.",
        "• Neutral: No Node or browser assumptions — great for shared libraries.",
        "",
        "Now choose your platform:",
    ].join("\n"),
    sourcemap: [
        "Source Maps",
        "Map your built code back to original TS/JS for better stack traces and debugging.",
        "Pros: easier debugging; Cons: larger publish size and slightly slower builds.",
        "",
        "Generate sourcemaps?",
    ].join("\n"),
    typeDeclaration: [
        "Type Declaration",
        "Declaration files (.d.ts) are an essential part of TypeScript libraries, providing type definitions that allow consumers of your library to benefit from TypeScript's type checking and IntelliSense.",
        "It's highly recommended to accept it",
        "Generate declarations?"
    ].join("\n"),
    cleanOutput: [
        "Cleaning",
        "Cleaning will delete all files currently exist in the outDirectory (e.g 'dist')",
        "It's recommended to remove those files so that older builds removed but in some cases you might want it to be false.",
        "One example might be when you want different builds (e.g. one for 'esm' and another for 'iife'), so you want past build remains",
        "Clean old builds?"
    ].join("\n"),
    separateFormats: [
        "Format Separation",
        "Do you want each output format in a separate sub-directory (e.g. 'dist/esm') ?"
    ].join("\n"),
    autoExport: [
        "Auto modify exports",
        "Accepting this option will modify the `package.json` file and sets `main`,`module`,`types`, `exports` attributes when required.",
        "While the package is designed to be accurate, the result might not be exactly what expected.",
        "So remember to do a double check to make sure everything is fine.",
        "",
        "Do you wish automate package.json modification?"
    ].join("\n"),
}