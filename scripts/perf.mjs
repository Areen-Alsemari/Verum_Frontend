// Frame-rate estimate for the Command center 3D view in headless Chrome at 1920x1080 (mock mode).
// Usage: node scripts/perf.mjs [--gl swiftshader|default]
// Headless numbers are an estimate only: they depend on the GL backend the headless browser gets.
import { chromium } from 'playwright-core'
import { startMockServer } from './lib/devserver.mjs'

const i = process.argv.indexOf('--gl')
const GL = i === -1 ? 'default' : process.argv[i + 1]
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const args = GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist']
const server = await startMockServer(5196)
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.goto(`${server.url}/#/scenarios`)
  await page.locator('[data-scenario="developing_fault"]').first().click()
  await page.selectOption('#mock-speed', '8')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Run finished' }).first().waitFor({ timeout: 60000 })
  await page.evaluate(() => { window.location.hash = '#/command' })
  await page.waitForTimeout(3000)
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
  })
  const measure = () => page.evaluate(() => new Promise((res) => {
    const times = []
    let last = performance.now()
    const t0 = last
    const f = (t) => { times.push(t - last); last = t; if (t - t0 < 4000) requestAnimationFrame(f); else res(times) }
    requestAnimationFrame(f)
  }))
  const stats = (ts) => {
    const s = [...ts].sort((a, b) => a - b)
    return { fps: +(1000 / (ts.reduce((a, b) => a + b, 0) / ts.length)).toFixed(1), p95ms: +s[Math.floor(s.length * 0.95)].toFixed(1) }
  }
  const normal = stats(await measure())
  await page.getByLabel('Low detail').check()
  await page.waitForTimeout(1500)
  const low = stats(await measure())
  console.log(JSON.stringify({ gl: GL, renderer, viewport: '1920x1080', normal, lowDetail: low }))
} finally {
  await browser.close()
  server.stop()
}
