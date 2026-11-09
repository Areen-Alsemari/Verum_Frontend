import type { AgentInfo, AssetId, FlaggedAsset, Severity } from '../api'

const ASSETS: { id: AssetId; label: string; x: number }[] = [
  { id: 'storage_tank', label: 'Storage tank', x: 90 },
  { id: 'pump', label: 'Pump', x: 270 },
  { id: 'valve', label: 'Valve', x: 450 },
  { id: 'pipeline', label: 'Pipeline', x: 630 },
  { id: 'sensor', label: 'Sensor', x: 800 },
  { id: 'terminal', label: 'Terminal', x: 930 },
]
const SEV_COLOR: Record<Severity, string> = { info: 'var(--blue)', warning: 'var(--yellow)', critical: 'var(--red)' }

function Shape({ id }: { id: AssetId }) {
  switch (id) {
    case 'storage_tank':
    case 'terminal':
      return (<g><path d="M-34 -34v68a34 10 0 0 0 68 0v-68" /><ellipse cx="0" cy="-34" rx="34" ry="10" /><path d="M-34 -8h68M-34 14h68" opacity="0.5" /></g>)
    case 'pump':
      return (<g><circle cx="6" cy="0" r="24" /><circle cx="6" cy="0" r="9" /><rect x="-40" y="-14" width="22" height="28" rx="4" /><path d="M-16 0h-2M-34 34h60" /></g>)
    case 'valve':
      return (<g><path d="M-26 -18l26 18l-26 18zM26 -18l-26 18l26 18z" /><path d="M0 0v-30M-16 -30h32" /><path d="M-34 34h68" opacity="0.5" /></g>)
    case 'pipeline':
      return (<g><rect x="-62" y="-14" width="124" height="28" rx="3" /><path d="M-36 -22v44M36 -22v44" /></g>)
    case 'sensor':
      return (<g><circle cx="0" cy="-22" r="22" /><path d="M0 -22l10 -10M0 0v32M-12 32h24" /><circle cx="0" cy="-22" r="2" /></g>)
  }
}

interface Props {
  flagged: FlaggedAsset[] | null
  agents: AgentInfo[]
}

export function AssetChain({ flagged, agents }: Props) {
  const by = new Map((flagged ?? []).map((f) => [f.asset, f]))
  const short = (k: string) => agents.find((a) => a.role_key === k)?.name ?? k
  return (
    <figure className="chain">
      <svg viewBox="0 0 1020 250" role="img" aria-label="Asset chain: storage tank, pump, valve, pipeline, sensor, terminal. Only assets flagged by agents are highlighted.">
        <defs>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d="M30 110H990" className="chain-pipe" />
        {ASSETS.map((a) => {
          const f = by.get(a.id)
          const color = f ? (f.severity ? SEV_COLOR[f.severity] : 'var(--amber-hi)') : undefined
          return (
            <g key={a.id} transform={`translate(${a.x} 110)`} className={`asset${f ? ' is-flagged' : ''}`} style={color ? { ['--asset' as string]: color } : undefined}>
              {f && <circle r="66" className="asset-ring" filter="url(#glow)" />}
              <g className="asset-shape"><Shape id={a.id} /></g>
              <text y="86" textAnchor="middle" className="asset-label">{a.label}</text>
              {f && (
                <text y="106" textAnchor="middle" className="asset-flag">
                  {f.flagged_by.length === 0 ? 'flagged' : `flagged by ${f.flagged_by.length} agent${f.flagged_by.length === 1 ? '' : 's'}`}
                </text>
              )}
              <title>{f ? `${a.label}: flagged by ${f.flagged_by.map(short).join(', ') || 'unknown'}${f.note ? `. ${f.note}` : ''}` : `${a.label}: not flagged`}</title>
            </g>
          )
        })}
      </svg>
      <figcaption className="control-help">
        {flagged === null ? 'The chain is highlighted when the run finishes.'
          : flagged.length === 0 ? 'No asset was flagged by any agent.'
          : 'Highlighted: only the assets that agents flagged. Colour follows the severity given by the API.'}
      </figcaption>
    </figure>
  )
}
