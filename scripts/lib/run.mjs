// Opens the "All controls" card, picks a scenario, sets 8x playback, runs it and waits for the end.
export async function runScenario(page, baseUrl, id) {
  await page.goto(`${baseUrl}/#/command`)
  await page.getByRole('button', { name: 'All controls' }).click()
  const dlg = page.getByRole('dialog', { name: 'Scenarios and controls' })
  await dlg.locator(`[data-scenario="${id}"]`).first().click()
  await dlg.locator('#mock-speed').selectOption('8')
  await dlg.getByRole('button', { name: 'Run', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Run finished' }).first().waitFor({ timeout: 60000 })
}
