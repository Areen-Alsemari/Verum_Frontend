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

/** CSS-only page footer for print: the one-line limitation on the left, page numbers on the right. */
const PAGE_CSS = `@page { size: A4; margin: 16mm 14mm 18mm;
  @bottom-left { content: "Advisory only: a person decides."; font: 8pt Inter, sans-serif; color: #5a544a; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Inter, sans-serif; color: #5a544a; } }`

export function ReportTab({ run, onPickWindow, onRetry }: Props) {
  const rep = run.report
  const model = useMemo(() => (rep.state === 'ok' ? buildReportModel(run, rep.report, rep.window) : null), [run, rep])
  if (rep.state !== 'ok' || !model) return <>{reportNotice(rep, onRetry)}</>
  const latest = rep.windowsAvailable.length ? Math.max(...rep.windowsAvailable) : rep.window
  const download = () => {
    // the full service data, including the limitations and missing information left out of the printed report
    const data = { report: rep.report, window_index: rep.window, run_id: run.run?.run_id ?? null, mode: run.mode, time_compression: run.timeCompression, data: run.dataNote }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${rep.report.report_id ?? `report-${run.run?.run_id ?? 'run'}`}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <div className="report-wrap">
      <style>{PAGE_CSS}</style>
      <div className="report-actions" role="group" aria-label="Report actions">
        <Select id="report-window" label="Window" variant="compact" value={String(rep.window)}
          options={(rep.windowsAvailable.length ? rep.windowsAvailable : [rep.window]).map((w) => ({ value: String(w), label: `Window ${w}${w === latest ? ' (latest)' : ''}` }))}
          onChange={(v) => onPickWindow(Number(v))} />
        <span className="report-status" role="status">Report for window {rep.window}</span>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} title="Opens the print dialog. Choose Save as PDF as the destination.">Download PDF</button>
        <button type="button" className="btn" onClick={download} title="The full data of the report as a file, including the technical notes.">Download data</button>
      </div>
      <ReportCard model={model} />
    </div>
  )
}
