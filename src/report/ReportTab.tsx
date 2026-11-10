import { useMemo } from 'react'
import type { AgentInfo, Scenario } from '../api'
import type { Facility } from '../facility'
import { waitingText } from '../components/ResultView'
import type { RunState } from '../state/runState'
import { buildReportModel } from './model'
import { ReportCard } from './ReportCard'

interface Props {
  run: RunState
  agents: AgentInfo[]
  scenario: Scenario | undefined
  facility: Facility
  snapshots: Record<string, string | null>
  source: 'api' | 'mock'
  /** snapshots still being rendered */
  pending: boolean
}

/** CSS-only page footer for print: report id on the left, page numbers on the right. */
function pageCss(reportId: string | null): string {
  const id = (reportId ?? 'report id unknown').replace(/["\\\n]/g, '')
  return `@page { size: A4; margin: 16mm 14mm 18mm;
  @bottom-left { content: "${id} · Advisory only. A human decides."; font: 8pt Inter, sans-serif; color: #5a544a; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Inter, sans-serif; color: #5a544a; } }`
}

export function ReportTab({ run, agents, scenario, facility, snapshots, source, pending }: Props) {
  const model = useMemo(() => buildReportModel({ run, agents, scenario, facility, snapshots, source }), [run, agents, scenario, facility, snapshots, source])
  if (!run.bundle) return <p className="state-msg" role="status">{waitingText(run)}</p>
  const download = () => {
    const data = { report: run.report ?? null, result_bundle: run.bundle, run_id: run.runId, scenario_id: run.scenarioId, simulated: true }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${model.header.reportId ?? `report-${run.runId ?? 'unknown'}`}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <div className="report-wrap">
      <style>{pageCss(model.header.reportId)}</style>
      <div className="report-actions glass" role="group" aria-label="Report actions">
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={pending}>Save as PDF</button>
        <button type="button" className="btn" onClick={download}>Download report data (JSON)</button>
        <span className="control-help">{pending ? (run.report === undefined ? 'Loading the report…' : 'Capturing the 3D snapshot…') : 'Save as PDF opens the print dialog; choose "Save as PDF" as the destination.'}</span>
      </div>
      <ReportCard model={model} facility={facility} />
    </div>
  )
}
