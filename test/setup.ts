import { readFileSync } from 'fs'
import { join } from 'path'
import createVerovioModule from 'verovio/wasm'
import { VerovioToolkit } from 'verovio/esm'
import { Resvg } from '@resvg/resvg-js'

let cachedToolkit: VerovioToolkit | null = null

export async function getToolkit(): Promise<VerovioToolkit> {
  if (cachedToolkit) return cachedToolkit
  const module = await createVerovioModule()
  cachedToolkit = new VerovioToolkit(module)
  return cachedToolkit
}

export function loadFixture(name: string): string {
  return readFileSync(join(__dirname, name), 'utf-8')
}

export function renderToPng(svgString: string): Buffer {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: 1200 },
  })
  const pngData = resvg.render()
  return Buffer.from(pngData.asPng())
}

export function pixelDiff(png1: Buffer, png2: Buffer): number {
  // Quick size check — if sizes differ drastically, return 100%
  if (Math.abs(png1.length - png2.length) / Math.max(png1.length, png2.length) > 0.5) {
    return 100
  }

  const len = Math.min(png1.length, png2.length)
  let diffCount = 0
  for (let i = 0; i < len; i++) {
    if (png1[i] !== png2[i]) diffCount++
  }
  // Also count excess bytes as diffs
  diffCount += Math.abs(png1.length - png2.length)

  return (diffCount / Math.max(png1.length, png2.length)) * 100
}
