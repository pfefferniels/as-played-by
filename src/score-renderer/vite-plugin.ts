import type { Plugin } from 'vite'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { renderMEItoSVGs, combineSVGs } from './render'
import { countRecordings } from './asPMX'

async function renderMEIFile(meiPath: string, outputDir: string) {
    const meiContent = await readFile(meiPath, 'utf-8')
    const name = basename(meiPath, '.mei')
    const numRecordings = Math.max(1, countRecordings(meiContent))

    console.log(`[score-renderer] Rendering ${meiPath} (${numRecordings} recording(s))...`)

    try {
        for (let ri = 0; ri < numRecordings; ri++) {
            const suffix = numRecordings > 1 ? `.${ri}` : ''
            const svgDir = join(outputDir, `${name}-score${suffix}`)
            await mkdir(svgDir, { recursive: true })

            const svgs = await renderMEItoSVGs(meiContent, {
                backend: 'local',
                recordingIndex: ri,
            })

            for (let i = 0; i < svgs.length; i++) {
                await writeFile(join(svgDir, `system_${i}.svg`), svgs[i], 'utf-8')
            }

            const combinedPath = join(outputDir, `${name}.score${suffix}.svg`)
            await writeFile(combinedPath, combineSVGs(svgs), 'utf-8')

            console.log(`[score-renderer]   Recording ${ri}: ${svgs.length} system(s)`)
        }
    } catch (err) {
        console.warn(`[score-renderer] Failed to render ${meiPath}: ${err}`)
        console.warn('[score-renderer] Viewer will fall back to Verovio rendering')
    }
}

async function renderAllMEI(publicDir: string) {
    const { globSync } = await import('glob')
    const meiFiles = globSync(join(publicDir, '*.mei'))

    for (const meiFile of meiFiles) {
        await renderMEIFile(meiFile, publicDir)
    }
}

export function scoreRendererPlugin(): Plugin {
    let publicDir: string

    return {
        name: 'score-renderer',

        configResolved(config) {
            publicDir = config.publicDir
        },

        async buildStart() {
            if (!existsSync(publicDir)) return
            await renderAllMEI(publicDir)
        },

        configureServer(server) {
            server.watcher.on('change', async (path: string) => {
                if (path.endsWith('.mei') && path.startsWith(publicDir)) {
                    await renderMEIFile(path, publicDir)
                    server.ws.send({ type: 'full-reload' })
                }
            })
        },
    }
}
