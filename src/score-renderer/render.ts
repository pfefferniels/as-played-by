import { execFile } from 'child_process'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { JSDOM } from 'jsdom'
import { asPMX } from './asPMX'
import { serialize } from './PMX'

type Backend = 'web' | 'local'

/**
 * Renders a PMX string to SVG using the web API (score.sapp.org).
 */
async function renderPMXtoSVGWeb(pmxContent: string): Promise<string> {
    const params = new URLSearchParams()
    params.set('outputformat', 'svg')
    params.set('embedpmx', 'false')
    params.set('crop', 'true')
    params.set('scaling', '1.8')
    params.set('padding', '1')
    params.set('inputdata', pmxContent)

    const response = await fetch('https://score.sapp.org/cgi-bin/score', {
        method: 'POST',
        body: params,
    })

    if (!response.ok) {
        throw new Error(`SCORE web API error: ${response.status} ${response.statusText}`)
    }

    return response.text()
}

/**
 * Renders a PMX string to SVG using the local pmx-to-eps + seps2svg pipeline.
 * pmx-to-eps writes EPS to stdout; seps2svg reads an EPS file and writes
 * the SVG next to it (e.g. foo.eps → foo.svg).
 */
async function renderPMXtoSVGLocal(pmxContent: string): Promise<string> {
    const id = randomUUID()
    const pmxPath = join(tmpdir(), `${id}.pmx`)
    const epsPath = join(tmpdir(), `${id}.eps`)
    const svgPath = join(tmpdir(), `${id}.svg`)

    // Resolve tools relative to project root
    const projectRoot = join(import.meta.dirname, '..', '..')
    const pmxToEps = join(projectRoot, 'tools', 'pmx-to-eps')
    const scoreLib = join(projectRoot, 'tools', 'score-lib')

    await writeFile(pmxPath, pmxContent, 'utf-8')

    try {
        // Step 1: PMX → EPS (pmx-to-eps writes EPS to stdout)
        const epsData = await new Promise<string>((resolve, reject) => {
            execFile(pmxToEps, [`--lib=${scoreLib}`, pmxPath], (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`pmx-to-eps failed: ${stderr || error.message}`))
                } else {
                    resolve(stdout)
                }
            })
        })

        await writeFile(epsPath, epsData, 'utf-8')

        // Step 2: EPS → SVG via seps2svg (writes .svg next to .eps)
        await new Promise<void>((resolve, reject) => {
            execFile('seps2svg', [epsPath], (error, _stdout, stderr) => {
                if (error) {
                    reject(new Error(`seps2svg failed: ${stderr || error.message}`))
                } else {
                    resolve()
                }
            })
        })

        return await readFile(svgPath, 'utf-8')
    } finally {
        // Clean up temp files
        await Promise.allSettled([
            unlink(pmxPath),
            unlink(epsPath),
            unlink(svgPath),
        ])
    }
}

/**
 * Renders a single PMX string to SVG.
 */
async function renderPMXtoSVG(
    pmxContent: string,
    options?: { backend?: Backend }
): Promise<string> {
    const backend = options?.backend ?? 'local'

    if (backend === 'web') {
        return renderPMXtoSVGWeb(pmxContent)
    } else {
        return renderPMXtoSVGLocal(pmxContent)
    }
}

/**
 * Orchestrates the full pipeline: MEI → PMX systems → SVG per system.
 * Returns an array of SVG strings, one per system.
 */
export async function renderMEItoSVGs(
    meiContent: string,
    options?: { backend?: Backend; recordingIndex?: number }
): Promise<string[]> {
    const pmxSystems = asPMX(meiContent, options?.recordingIndex ?? 0)
    const svgs: string[] = []

    for (const pmx of pmxSystems) {
        const pmxString = serialize(pmx)
        const svg = await renderPMXtoSVG(pmxString, options)
        svgs.push(svg)
    }

    return svgs
}

/**
 * Combines multiple SVG strings into a single SVG document,
 * stacking systems vertically.
 */
export function combineSVGs(svgs: string[]): string {
    if (svgs.length === 0) return ''
    if (svgs.length === 1) return svgs[0]

    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    const doc = dom.window.document

    let totalHeight = 0
    let maxWidth = 0
    const parsed: { svg: Element; width: number; height: number }[] = []

    for (const svgStr of svgs) {
        const svgDoc = new JSDOM(svgStr, { contentType: 'image/svg+xml' })
        const svg = svgDoc.window.document.documentElement
        const viewBox = svg.getAttribute('viewBox')
        let width = parseFloat(svg.getAttribute('width') || '0')
        let height = parseFloat(svg.getAttribute('height') || '0')

        if (viewBox) {
            const parts = viewBox.split(/\s+/).map(Number)
            if (parts.length === 4) {
                width = width || parts[2]
                height = height || parts[3]
            }
        }

        parsed.push({ svg, width, height })
        totalHeight += height
        if (width > maxWidth) maxWidth = width
    }

    const spacing = 10
    totalHeight += spacing * (svgs.length - 1)

    const combined = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    combined.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    combined.setAttribute('viewBox', `0 0 ${maxWidth} ${totalHeight}`)
    combined.setAttribute('width', String(maxWidth))
    combined.setAttribute('height', String(totalHeight))

    let yOffset = 0
    for (const { svg, height } of parsed) {
        const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
        g.setAttribute('transform', `translate(0, ${yOffset})`)

        // Copy all children from the parsed SVG
        for (const child of Array.from(svg.childNodes)) {
            const imported = doc.importNode(child, true)
            g.appendChild(imported)
        }

        combined.appendChild(g)
        yOffset += height + spacing
    }

    return combined.outerHTML
}
