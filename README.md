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

---

## Quick start

```bash
# in your package
npm i -D ts-build-wizard   # or install globally; your call
npx ts-build-wizard
```

The wizard will:
1. Check for `package.json` and `tsconfig.json` (creates a sane `tsconfig.json` if missing).
2. Ask about **entry**, **formats** (esm/cjs/iife), **platform** (node/browser/neutral), **sourcemaps**, **types**, **minify**, and **clean**.
3. Save your choices to **`tsbuild.wizard.json`**.
4. Install `typescript` + `tsdown` if needed.
5. Run the build.

Next time, it will detect `tsbuild.wizard.json` and ask if you want to **reuse** it.

---

## Concepts (what the questions mean)

- **Entry file**
    - It can be single or multiple files. In this file you need to export things that think other might need to import/require when using your package.
    - If FUNCTION_A has used FUNCTION_B, then exporting FUNCTION_A, will build and bundle FUNCTION_B in the package automatically (so FUNCTION_A can use it), but the package user won't be able to import/require FUNCTION_B.

- **Formats**
    - **ESM** (for `import …`) – modern JS modules.
    - **CJS** (for `require(…)`) – Node/CommonJS.
    - **IIFE** – a single browser bundle exposed as a **global** (e.g., `window.MyLib`).

- **Platform**
    - **node** – Node.js runtime (and most Node-compatible runtimes like Bun).
    - **browser** – web browsers/CDN.
    - **neutral** – no Node/browser polyfills; best for shared libraries.

- **Sourcemaps**
    - Maps your built code back to your TS files for better stack traces and debugging.
    - Trade-off: larger artifacts and slightly slower builds.

- **Type declarations (`.d.ts`)**
    - Highly recommended for library consumers using TypeScript/IDE IntelliSense.

- **Clean**
    - If **true**, the output folder (e.g., `dist`) is cleared before building.
    - Set **false** when you intentionally run multiple builds into the same folder (e.g., two passes with different platforms).

---

## Node built-ins (fs, path, …) and platform **neutral**

If your library touches **Node built-ins** (e.g., `fs`, `path`) and you select **neutral**:
- Neutral **does not** polyfill Node APIs for the browser.
- You must either:
    1. **Split entries as object with `client`, `server` keys**: (recommended)
        - `src/index.client.ts` (no Node built-ins)
        - `src/index.server.ts` (Node-only logic)
        - In the wizard, set entries like:  
          `{ client: "src/index.client.ts", server: "src/index.server.ts" }`
        - **Note 1:** paths could be anything (e.g. "src/clientSide.ts"), but keys should be `client` and `server` so that system can recognize the situation.
        - **Note 2:** If you follow this approach properly you shouldn't see any warning about Node built-ins usage, if any warning appeared it means some Node built-ins is used in client side.
        - **Note 3:** assume you've a function like `checkAccess` which is not using Node built-ins, and you have exported it in `index.client.ts` but it would become handy in server side too, in this case it would be nice (slightly recommended) that export it in `index.server.ts` too, so user won't need to import both in his code.
       
    2. **Run the wizard twice**, changing `platform` each time, and set **Clean = No** on the second pass so previous outputs are kept.

---

## IIFE and multiple file entry

Because IIFE code is capsulated in only one block, the `tsdown` library also expect single File entry. So you can manually creat a single file that exports all the features you wish and path it as entry.

If you don't, then my system will automatically merge all the File entries into a single file, and will use it as File entry.

---

## Altering `package.json` (library)

Thanks to `tsdown`'s experimental feature, the system will automatically modify the `package.json` and assigns proper attributes like `main`, `module`, `types`, `exports`.
However, as this feature is experimental, it's better to duble-check for any issues.

The resulting package should be something like this:
```jsonc
{
  "name": "react-app-registry",
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
    }
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

> If you ship a browser-specific IIFE file, you can also wire a `browser` condition or document the path directly.

---

## Reusing configuration

The wizard writes:
- **`tsbuild.wizard.json`** – your choices (entry, formats, platform, sourcemap, etc.).
- **`.tmp-wizard/iife.entry.ts`** – auto-generated barrel (only when needed for IIFE + glob/multi-entry).

On the next run, it will offer to **reuse** the previous config.  
Add `.tmp-wizard/` to `.gitignore`. You can choose whether to commit `tsbuild.wizard.json` (team-wide) or ignore it (per-dev).

---

## Scripts (optional)

If you want a one-liner build:

```json
{
  "scripts": {
    "build": "ts-build-wizard"
  }
}
```

---

## Troubleshooting

- **Bundler warns about `fs`/`path` in ESM**
    - Ensure your browser entry doesn’t import Node built-ins, or split into browser/server entries as shown above.
- **IIFE + multiple entries**
    - IIFE needs a **single** entry (it exposes one global). Use a **barrel** entry or let the wizard auto-generate one from a glob.
- **Nothing happens / Not found**
    - Ensure your project has a `package.json`.
    - Make sure the **entry** paths actually exist.
    - If you selected “neutral”, remember it won’t polyfill Node APIs.
- **Rebuild with previous settings**
    - Re-run the wizard and choose **Reuse** when prompted.

---

## License

MIT © [Alireza Tabatabaeian](https://github.com/Alireza-Tabatabaeian)
