import { cp } from 'node:fs/promises'

export const BACKUP_DIRECTORY = '.TSBW-BKUP'

export const createDistBackup = async (outDir: string) => {
    try{
        await cp(outDir, BACKUP_DIRECTORY, {force: true,recursive: true})
        return true
    }
    catch {
        return false
    }
}