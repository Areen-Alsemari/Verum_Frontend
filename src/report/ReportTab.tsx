import { useMemo } from 'react'
import { Select } from '../components/Select'
import { reportNotice } from '../components/Block'
import type { RunState } from '../state/runState'
import { buildReportModel } from './model'
import { ReportCard } from './ReportCard'

interface Props {
  run: RunState
  onPickWindow: (w: number) => void
  onRetry: () => void
}

/** CSS-only page footer for print: report id on the left, page numbers on the right. */
function pageCss(reportId: string | null): string {
  const id = (reportId ?? 'report id not available').replace(/["\\\n]/g, '')
  return `@page { size: A4; margin: 16mm 14mm 18mm;
  @bottom-left { content: "${id} · Advisory only. A human decides."; font: 8pt Inter, sans-serif; color: #5a544a; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Inter, sans-serif; color: #5a544a; } }`
}

export function ReportTab({ run, onPickWindow, onRetry }: Props) {
  const rep = run.report
  const model = useMemo(() => (rep.state === 'ok' ? buildReportModel(run, rep.report, rep.window) : null), [run, rep])
  if (rep.state !== 'ok' || !model) return <>{reportNotice(rep, onRetry)}</>
  const download = () => {
    const data = { report: rep.report, window_index: rep.window, run_id: run.run?.run_id ?? null, mode: run.mode, time_compression: run.timeCompression, data: run.dataNote }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${model.header.reportId ?? `report-${run.run?.run_id ?? 'run'}`}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <div className="report-wrap">
      <style>{pageCss(model.header.reportId)}</style>
      <div className="report-actions glass" role="group" aria-label="Report actions">
        {rep.windowsAvailable.length > 1 && (
          <Select id="report-window" label="Window" value={String(rep.window)} options={rep.windowsAvailable.map((w) => ({ value: String(w), label: `Window ${w}` }))} onChange={(v) => onPickWindow(Number(v))} />
        )}
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Save as PDF</button>
        <button type="button" className="btn" onClick={download}>Download report data (JSON)</button>
        <span className="control-help">Default is the last window. Save as PDF opens the print dialog; choose "Save as PDF" as the destination.</span>
      </div>
      <ReportCard model={model} />
    </div>
  )
}
