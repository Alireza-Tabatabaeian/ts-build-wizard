import fs from "node:fs"
import {execSync} from "node:child_process"
import path from "node:path"

export const ensureDeps = async () => {
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

const detectPackageManager = (cwd = process.cwd()) => {
    const p = (f: string) => fs.existsSync(path.join(cwd, f))
    if (p("pnpm-lock.yaml")) return "pnpm"
    if (p("yarn.lock")) return "yarn"
    if (p("bun.lockb")) return "bun"
    return "npm"
}