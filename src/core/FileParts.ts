export class FileParts {
    parts: string[]
    baseFileName: string

    constructor(parts: string[], baseFileName: string) {
        this.parts = parts
        this.baseFileName = baseFileName
    }

    toAlias = (iife: boolean = false) : string => {
        const rep : string = iife ? '_' : '/'
        return ((this.baseFileName !== 'index' || iife) ? this.parts.concat(this.baseFileName) : this.parts).join(rep).replace(/\\/g, rep)
    }

    toPath = () : string => {
        return this.parts.concat(this.baseFileName).join('/').replace(/\\/g, '/')
    }
}