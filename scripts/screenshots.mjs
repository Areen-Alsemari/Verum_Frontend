// Captures every tab (and the All controls card) for every mock scenario at 1920x1080 into screenshots/NN-<scenario>-TT-<tab>.png.
// Usage: npm run screenshots            (needs Google Chrome; set CHROME_PATH to override)
// Starts its own mock-mode dev server on port 5195.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { startMockServer } from './lib/devserver.mjs'
import { runScenario } from './lib/run.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SCENARIOS = ['quiet_window', 'developing_fault', 'agent_conflict', 'agent_failure']
const TABS = ['command', 'controls', 'agents', 'log', 'investigation', 'inspection', 'report']
mkdirSync('screenshots', { recursive: true })

const server = await startMockServer(5195)
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] })
let failed = false
try {
  for (const [n, id] of SCENARIOS.entries()) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))
    await runScenario(page, server.url, id)
    for (const [t, tab] of TABS.entries()) {
      // "controls" is the All controls card over the command center, not a tab
      if (tab === 'controls') await page.getByRole('button', { name: 'All controls' }).click()
      else await page.evaluate((h) => { window.location.hash = `#/${h}` }, tab)
      if (tab === 'report') await page.getByRole('button', { name: 'Save as PDF' }).and(page.locator(':enabled')).waitFor({ timeout: 40000 })
      await page.mouse.move(0, 0)
      await page.waitForTimeout(tab === 'command' || tab === 'investigation' ? 3500 : 900)
      const file = `screenshots/${String(n + 1).padStart(2, '0')}-${id}-${String(t + 1).padStart(2, '0')}-${tab}.png`
      await page.screenshot({ path: file })
      console.log('wrote', file)
      if (tab === 'controls') await page.keyboard.press('Escape')
    }
    if (errors.length) { failed = true; console.error(`console errors in ${id}:\n  ${errors.join('\n  ')}`) }
    await page.close()
  }
} finally {
  await browser.close()
  server.stop()
}
if (failed) process.exit(1)
