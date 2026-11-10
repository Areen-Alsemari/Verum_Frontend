// Starts a mock-mode Vite dev server for scripts and stops it reliably (no orphaned child process).
import { spawn } from 'node:child_process'

export async function startMockServer(port) {
  try {
    await fetch(`http://localhost:${port}/`)
    throw new Error(`port ${port} is already in use; stop that server or pick another port`)
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('port')) throw e
  }
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], {
    env: { ...process.env, VITE_API_MODE: 'mock' },
    stdio: 'ignore',
  })
  const stop = () => { if (!server.killed) server.kill('SIGTERM') }
  process.on('exit', stop)
  process.on('SIGINT', () => { stop(); process.exit(130) })
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://localhost:${port}/`)).ok) return { url: `http://localhost:${port}`, stop } } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  stop()
  throw new Error('dev server did not start')
}
