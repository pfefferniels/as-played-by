import { Command } from 'commander'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { renderMEItoSVGs, combineSVGs } from './render'
import { countRecordings } from './asPMX'

const program = new Command()

program
    .version('0.1.0')
    .description('Render aligned MEI files to SVGs via the SCORE engine')
    .requiredOption('-m, --mei <file>', 'Path to the aligned MEI file')
    .option('-o, --output <dir>', 'Output directory', './output')
    .option('--backend <backend>', 'Rendering backend: "web" or "local"', 'local')
    .parse(process.argv)

const options = program.opts<{
    mei: string
    output: string
    backend: 'web' | 'local'
}>()

const mei = readFileSync(options.mei, 'utf-8')
const numRecordings = Math.max(1, countRecordings(mei))

mkdirSync(options.output, { recursive: true })

console.log(`Rendering ${options.mei} using ${options.backend} backend (${numRecordings} recording(s))...`)

for (let ri = 0; ri < numRecordings; ri++) {
    const suffix = numRecordings > 1 ? `.${ri}` : ''

    console.log(`\n  Recording ${ri}:`)

    const svgs = await renderMEItoSVGs(mei, {
        backend: options.backend,
        recordingIndex: ri,
    })

    for (let i = 0; i < svgs.length; i++) {
        const outPath = join(options.output, `system_${i}${suffix}.svg`)
        writeFileSync(outPath, svgs[i], 'utf-8')
        console.log(`    Written ${outPath}`)
    }

    // Also write a combined SVG
    const combinedPath = join(options.output, `combined${suffix}.svg`)
    writeFileSync(combinedPath, combineSVGs(svgs), 'utf-8')
    console.log(`    Written ${combinedPath}`)

    console.log(`  Done. ${svgs.length} system(s) rendered.`)
}
