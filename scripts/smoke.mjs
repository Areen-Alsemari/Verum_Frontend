// Headless smoke check: opens the running mock-mode app, optionally runs a scenario,
// visits the given tabs, and fails on console errors or page errors.
// Usage: node scripts/smoke.mjs [--url http://localhost:5199] [--scenario developing_fault] [--tabs command,report] [--shot dir]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i === -1 ? d : process.argv[i + 1]
}
const URL = arg('url', 'http://localhost:5199')
const SCENARIO = arg('scenario', '')
const TABS = arg('tabs', '').split(',').filter(Boolean)
const SHOT = arg('shot', '')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(URL)
await page.waitForTimeout(800)
if (SCENARIO) {
  await page.evaluate((id) => { window.location.hash = '#/scenarios' ; return id }, SCENARIO)
  await page.waitForTimeout(300)
  await page.locator(`[data-scenario="${SCENARIO}"]`).first().click()
  await page.selectOption('#mock-speed', '8')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Run finished' }).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(600)
}
if (SHOT) mkdirSync(SHOT, { recursive: true })
for (const t of TABS.length ? TABS : ['']) {
  if (t) await page.evaluate((h) => { window.location.hash = `#/${h}` }, t)
  await page.waitForTimeout(1500)
  if (SHOT) await page.screenshot({ path: `${SHOT}/${SCENARIO || 'idle'}-${t || 'home'}.png` })
}
await browser.close()
if (errors.length) {
  console.error('console errors:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('smoke ok', SCENARIO || '(no run)', TABS.join(','))
