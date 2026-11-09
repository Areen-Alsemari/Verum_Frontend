// Takes one screenshot per scenario in mock mode at 1920x1080 (full page).
// Usage: npm run screenshots            (needs Google Chrome; set CHROME_PATH to override)
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const PORT = 5199
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SCENARIOS = [
  ['quiet_window', 'Quiet window'],
  ['developing_fault', 'Developing fault'],
  ['agent_conflict', 'Conflicting agents'],
  ['agent_failure', 'Agent failure'],
]
mkdirSync('screenshots', { recursive: true })

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  env: { ...process.env, VITE_API_MODE: 'mock' },
  stdio: 'ignore',
})
const stop = () => server.kill()
process.on('exit', stop)

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('dev server did not start')
}

try {
  await waitUp()
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  let n = 1
  for (const [id, title] of SCENARIOS) {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`http://localhost:${PORT}/`)
    await page.getByRole('radio', { name: new RegExp(title) }).click()
    await page.selectOption('#mock-speed', '8')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Run finished' }).waitFor({ timeout: 60000 })
    await page.waitForTimeout(800)
    // grow the viewport to the page height so the fixed footer sits at the bottom of the shot
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: 1920, height: Math.max(1080, h) })
    await page.waitForTimeout(300)
    const file = `screenshots/${String(n).padStart(2, '0')}-${id}.png`
    await page.screenshot({ path: file, fullPage: false })
    console.log('wrote', file)
    n += 1
  }
  await browser.close()
} finally {
  stop()
}
