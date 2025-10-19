import {fileRelativeParts, findSourceDir} from "../src/fileTools"
import {describe, it, expect} from "vitest";


describe("Check stringToPathParts", () => {
    it("check source path", () => {
        const filePaths = [
            'source/sub/test1.ts',
            'source/sub/test2.ts'
        ]
        let source = findSourceDir(filePaths)
        expect(source).toEqual('source/sub')
        filePaths.push('source/new_sub/test2.ts')
        source = findSourceDir(filePaths)
        expect(source).toEqual('source')
        filePaths.push('source/index.ts')
        source = findSourceDir(filePaths)
        expect(source).toEqual('source')
        filePaths.push('lib/index.ts')
        source = findSourceDir(filePaths)
        expect(source).toEqual('.')
    })
    it("check route in src", () => {
        const path = 'src/dependencyHandler.ts'
        const pathParts = fileRelativeParts(path,'src')
        expect(pathParts.parts.length).toEqual(0)
        const alias = `./${pathParts.toAlias()}`
        const outputPath = `./${pathParts.toPath()}.js`
        expect(alias).toEqual('./dependencyHandler')
        expect(outputPath).toEqual('./dependencyHandler.js')
    })
    it("check index.* in src", () => {
        const path = 'src/index.ts'
        const pathParts = fileRelativeParts(path,'src')
        expect(pathParts.parts.length).toEqual(0)
        expect(`.${pathParts.toAlias()}`).toEqual('.')
        expect(`./${pathParts.toPath()}.js`).toEqual('./index.js')
    })
    it("check route in subdirectory of src", () => {
        const path = 'src/sub/dependencyHandler.ts'
        const pathParts = fileRelativeParts(path, 'src')
        expect(`./${pathParts.toAlias()}`).toEqual('./sub/dependencyHandler')
        expect(`./${pathParts.toPath()}`).toEqual('./sub/dependencyHandler')
    })
    it("check index in subdirectory of src", () => {
        const path = 'src/sub/test/index.ts'
        const pathParts = fileRelativeParts(path, 'src')
        expect(`./${pathParts.toAlias()}`).toEqual('./sub/test')
        expect(`./${pathParts.toPath()}`).toEqual('./sub/test/index')
    })
})