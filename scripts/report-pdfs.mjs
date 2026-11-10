// Prints the Report tab to PDF for each mock scenario with headless Chrome (page.pdf, print CSS, A4).
// Usage: node scripts/report-pdfs.mjs [outDir]   (needs Google Chrome; set CHROME_PATH to override)
// Starts its own mock-mode dev server on port 5197.
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { startMockServer } from './lib/devserver.mjs'
import { runScenario } from './lib/run.mjs'

const OUT = process.argv[2] || 'screenshots'
const PORT = 5197
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SCENARIOS = ['quiet_window', 'developing_fault', 'agent_conflict', 'agent_failure']
mkdirSync(OUT, { recursive: true })

const server = await startMockServer(PORT)

const pageCount = (file) => (readFileSync(file).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
try {
  for (const [n, id] of SCENARIOS.entries()) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))
    await runScenario(page, server.url, id)
    await page.evaluate(() => { window.location.hash = '#/report' })
    await page.getByRole('button', { name: 'Save as PDF' }).and(page.locator(':enabled')).waitFor({ timeout: 40000 })
    await page.waitForTimeout(500)
    const snaps = await page.locator('.report-card img[alt^="3D close-up"]').count()
    await page.emulateMedia({ media: 'print' })
    const file = `${OUT}/report-${String(n + 1).padStart(2, '0')}-${id}.pdf`
    await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true })
    results.push({ id, file, pages: pageCount(file), snapshots: snaps, errors })
    await page.close()
  }
} finally {
  await browser.close()
  server.stop()
}
for (const r of results) console.log(`${r.file}: ${r.pages} page(s), ${r.snapshots} 3D snapshot(s), console errors: ${r.errors.length}${r.errors.length ? `\n  ${r.errors.join("\n  ")}` : ""}`)
if (results.some((r) => r.pages < 1 || r.pages > 12 || r.errors.length)) process.exit(1)
