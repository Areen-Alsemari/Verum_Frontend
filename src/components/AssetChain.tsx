import type { AgentInfo, FlaggedAsset, Severity } from '../api'
import { STATIC_FACILITY, assetById, kindLabel } from '../facility'
import { humanText } from '../lib/labels'

const SEV_COLOR: Record<Severity, string> = { info: 'var(--blue)', warning: 'var(--yellow)', critical: 'var(--red)' }

interface Props {
  flagged: FlaggedAsset[] | null
  agents: AgentInfo[]
}

/** Flagged assets of the simulated terminal, by real asset id. Only assets that agents flagged are listed. */
export function AssetChain({ flagged, agents }: Props) {
  const short = (k: string) => agents.find((a) => a.role_key === k)?.name ?? k
  return (
    <figure className="chain">
      {flagged && flagged.length > 0 && (
        <ul className="cards">
          {flagged.map((f) => {
            const a = assetById(STATIC_FACILITY, f.asset)
            return (
              <li key={f.asset} className="mini-card" style={{ borderColor: f.severity ? SEV_COLOR[f.severity] : 'var(--amber-hi)' }}>
                <div className="mini-head"><strong><code>{f.asset}</code></strong>
                  <span className="pill">{a ? kindLabel(a.kind) : 'not in facility snapshot'}</span></div>
                <p className="control-help">flagged by {f.flagged_by.length} agent{f.flagged_by.length === 1 ? '' : 's'}: {f.flagged_by.map(short).join(', ') || 'unknown'}</p>
                {f.note && <p className="control-help">{humanText(f.note)}</p>}
              </li>
            )
          })}
        </ul>
      )}
      <figcaption className="control-help">
        {flagged === null ? 'Flagged assets appear when the run finishes.'
          : flagged.length === 0 ? 'No asset was flagged by any agent.'
          : 'Only the assets that agents flagged are listed. Colour follows the severity given by the API.'}
      </figcaption>
    </figure>
  )
}
