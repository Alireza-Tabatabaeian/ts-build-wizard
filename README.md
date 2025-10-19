# ts-build-wizard

A friendly CLI that builds your TypeScript package to **ESM**, **CJS**, and optional **IIFE** targets for **browser**, **server (Node)**, or **neutral** platforms — using [`tsdown`](https://www.npmjs.com/package/tsdown) under the hood.

It asks simple questions, explains each choice, installs what you need, remembers your answers, and runs the build.

---

## Features

- ✅ Builds **ESM** + **CJS** (and **IIFE** if you want a global for the browser)
- ✅ Targets **node**, **browser**, or **neutral** platforms
- ✅ **Sourcemaps** (optional)
- ✅ **Type declarations** (`.d.ts`)
- ✅ Auto-installs **TypeScript** + **tsdown** if missing
- ✅ Remembers your choices in `tsbuild.wizard.json`
- ✅ Reuses previous config on the next run (or lets you re-decide)
- ✅ Auto-merges multi-entry for **IIFE** (or when you ask to **merge in one**)
- ✅ Creates a **backup** of your output folder before cleaning

---

## Quick start

```bash
# in your package
npm i -D ts-build-wizard   # or install globally; your call
npx ts-build-wizard
```

The wizard will:
1. Check for `package.json` and `tsconfig.json` (creates a sane `tsconfig.json` if missing).
2. Ask about **entry**, **formats** (esm/cjs/iife), **platform** (node/browser/neutral), **sourcemaps**, **types**, **minify**, **clean**, and **auto-export**.
3. Save your choices to **`tsbuild.wizard.json`**.
4. Install `typescript` + `tsdown` if needed.
5. Run the build.

Next time, it will detect `tsbuild.wizard.json` and ask if you want to **reuse** it.

---

## Entry configuration (all the ways)

You can provide the **entry** in several shapes. The wizard accepts a **string**, **array**, **object**, or a **glob**. It normalizes your input internally.

### 1) Single string
```jsonc
"entry": "src/index.ts"
```

### 2) Array (multiple files)
```jsonc
"entry": ["src/index.ts", "src/cli.ts"]
```

### 3) Object (alias → file)
```jsonc
"entry": {
  "index": "src/main.ts",
  "tools": "src/tools/index.ts"
}
```
- **Export routes** for multi-entry are derived from file locations **relative to the common source folder** (e.g. `src/tools` → `./tools`). If the file name is `index.ts`, the `index` suffix is **omitted** from the export path (so `src/utils/index.ts` becomes export path `./utils`).

### 4) Glob
```jsonc
"entry": "src/**/*.ts"
```
- The wizard expands the files and (when needed) **auto-generates a barrel** to make them importable/exportable.

### 5) Client/Server split (special object)
Use this when your package has **browser** and **node** code separated:

```jsonc
"entry": {
  "client": "src/index.client.ts",
  "server": "src/index.server.ts",
  "tools":  "src/tools.ts",
  "demo":   "src/demo/pack.ts"

  "__default__": "node" // or omit / set anything else for "client" default
}
```
- Keys **must** be exactly `"client"` and `"server"`.
- `__default__` decides which side is considered the **default** export:
    - `__default__: "node"` → the **server** build becomes default
    - `__default__` missing or any other value → the **client** build becomes default
    - also if there exist more entries like `tools` and `demo`, then adding `__default__`: "node" → will cause those entries to be built for `node` platform. 
- The wizard builds **client** with `platform: "browser"` and **server** with `platform: "node"`. If your `formats` include `iife`, it is **excluded** from the server build automatically.

> Tip: If a utility (e.g., `checkAccess`) is shared by both sides, export it from **both** files so end users don’t have to import from two different subpaths.

---

## IIFE and multi-entry

IIFE bundles must start from a **single** file (they expose a single global). You have two options:

1) Create your own **barrel** that re-exports everything you want and pass **that** as the entry, **or**
2) Let the wizard **auto-merge** your multi-entry/glob into a temporary barrel under `.tmp-wizard/merged.entry.ts`:
    - If your `formats` include **`iife`**, the wizard will auto-merge for IIFE.
    - If you set **“Merge into single entry”** = **Yes**, the wizard will also build **non-IIFE** formats from that merged barrel.

When auto-merging for IIFE, the export names inside the barrel are made safe (slashes become underscores, etc.)

In special case of **Client/Server split** the wizard won't merge entries into single file, as it's nonsense. Yet if you have multiple entries to be built for browser and formats include **IIFE**, then the wizard will automatically create a barrel of all entries excluding `server`. 

---

## Platform and Node built-ins

- **node** – Node.js runtime (and Node-compatible runtimes like Bun).
- **browser** – Web browsers/CDN.
- **neutral** – No Node/browser polyfills. Good for shared libraries.

If your library references **Node built-ins** (`fs`, `path`, …) and you target **neutral** or **browser**, you must either:
- Split entries with **client/server** keys (recommended), or
- Run the wizard twice with different `platform` settings and set **Clean = No** on the second pass.

---

## Formats & directories

- **ESM** → `import …`
- **CJS** → `require(…)`
- **IIFE** → browser global (set **Global name** to choose e.g., `window.MyLib`)

If you enable **Separate format outputs**, builds go to subfolders:
```
dist/esm/…  dist/cjs/…  (and dist/iife/… if used)
```
Otherwise, all outputs land directly under `dist/`.

---

## Auto-exporting `package.json`

If you enable **Auto modify exports**, the wizard updates your `package.json` using your build outputs:
- Sets `main`, `module`, `types`
- Generates `exports`:
    - `"."` points to the default file (ESM if `"type":"module"` and ESM is built; otherwise CJS)
    - Additional entries map to subpaths like `"./tools"` etc.
- Ensures your `dist` folder appears in `"files"`

> This relies on `tsdown` behavior and your actual outputs. It’s robust but experimental — please **double-check** after a build.

**Example result:**
```jsonc
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "default": "./dist/index.mjs"
    },
    "./tools": {
      "types": "./dist/tools.d.ts",
      "import": "./dist/tools.mjs",
      "require": "./dist/tools.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

---

## Cleaning & backups

When **Clean** is **true**, the wizard:
1. **Backs up** your current output folder (e.g., `dist`) into **`.TSBW-BKUP/`**
2. **Deletes** the target output folder
3. Runs the build

If the backup fails, you’ll be asked whether to continue or stop.  
`.TSBW-BKUP/` is added to `.gitignore` automatically.

---

## Generated / helper files

- **`tsbuild.wizard.json`** – Saved choices. You can commit this for team-wide consistency.
- **`.tmp-wizard/merged.entry.ts`** – Auto-generated barrel used for IIFE or merge scenarios (safe to ignore/clean).
- **`.TSBW-BKUP/`** – Backup of your previous `dist` (only created when **Clean** is on).

Your `.gitignore` is updated to include: `dist`, `node_modules`, `.tmp-wizard`, `.TSBW-BKUP`.

---

## Scripts (optional)

If you want a one-liner build:

```json
{
  "scripts": {
    "build": "ts-build-wizard",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  }
}
```

Then run:
```bash
npm run build
```

#### Important: 
Even though I mentioned that this is **optional** to set `"build": "ts-build-wizard"`, It's ***highly recommended***. Some CI templates or dev habits run npm run build before publishing. If "build" points to tsc, it may overwrite the wizard’s output and produce a different dist/. Use tsc --noEmit for type-checking (e.g., npm run typecheck) and wire prepublishOnly to the wizarded build. 

---

## Troubleshooting & tips

- **“default files not found. unable to modify package.json automatically”**
    - Usually means expected outputs (`.mjs`/`.cjs`/`.d.mts`) weren’t produced where we looked. Recheck `outDir`/`formatDir` and whether your entry actually builds.
- **IIFE + multiple entries**
    - IIFE needs a single entry. Use a manual barrel or let the wizard auto-merge.
- **Browser build contains Node APIs**
    - Ensure your `client` entry and its imports avoid Node built-ins; otherwise, split client/server properly.
- **Choosing defaults in multi-entry (non client/server)**
    - If an entry file is named `index.ts`, it’s preferred as the **default**. Otherwise the first valid entry becomes default; the rest are exported under subpaths derived from their relative locations.
- **Export paths for sub-entries**
    - For files like `src/utils/index.ts`, the export path becomes `./utils` (no trailing `/index`). For non-`index` files, the file name is included (e.g., `src/utils/math.ts` → `./utils/math`).

---

## FAQ

**Q: If function A uses function B, but I only export A, can users import B?**  
**A:** No. Only **exported** symbols from your entry files are published for consumers. `B` will be bundled if needed by `A`, but it won’t be **publicly importable** unless you export it too.

**Q: Can I run separate “node” and “browser” builds into the same `dist/`?**  
**A:** Yes. Run the wizard twice with different `platform` choices. Make sure the **second run** sets **Clean = No** so the first results remain.

**Q: How is the IIFE global name set?**  
**A:** When `format = iife`, the wizard passes the **Global name** you provided to the bundler so your bundle is exposed as `window.<GlobalName>`.

---

## License

MIT © [Alireza Tabatabaeian](https://github.com/Alireza-Tabatabaeian)
