import type { AttentionItem } from '../lib/briefing'
import type { TabId } from '../shell/routes'
import { label } from '../lib/labels'

export function NeedsAttention({ items, onGo, idle }: { items: AttentionItem[]; onGo: (t: TabId) => void; idle: boolean }) {
  return (
    <section className="panel" aria-labelledby="attn-h">
      <div className="panel-head">
        <h3 id="attn-h" className="label panel-title">Needs attention</h3>
        {items.length > 0 && <span className="pill">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="control-help">{idle ? 'Nothing yet. Start a run.' : 'Nothing needs attention so far.'}</p>
      ) : (
        <ul className="attn-list">
          {items.map((it) => (
            <li key={it.key}>
              <button type="button" className={`attn tone-${it.tone}`} onClick={() => onGo(it.tab)}>
                <span className="attn-dot" aria-hidden="true" />
                <span className="attn-body">
                  <span className="attn-title">{it.title}</span>
                  {it.detail && <span className="control-help">{it.detail}</span>}
                </span>
                {it.code && <span className={`issue-code${it.tone === 'fail' ? ' is-fail' : ''}`} title={it.code}>{label(it.code)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
