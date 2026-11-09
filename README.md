# Verum demo frontend

Single-page demo UI for the Verum multi-agent industrial diagnostic pipeline.
Advisory only: a human decides, and no automatic action is authorised.
The UI works fully offline (fonts and images are self-hosted) and needs no backend in mock mode.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run test         # Vitest
npm run lint         # ESLint
npm run typecheck    # tsc, strict
```

## API modes

All API access goes through `src/api/`. Mode is chosen with `VITE_API_MODE`:

| value | behaviour |
|---|---|
| unset / `auto` | probe the backend; if unreachable use mock data and show a **Demo data** badge |
| `mock` | scripted mock data, no network |
| `real` | real backend only; failures are shown as errors |

```bash
VITE_API_MODE=mock npm run dev
VITE_API_MODE=real VITE_API_BASE=http://127.0.0.1:8765 npm run dev
```

`VITE_API_BASE` defaults to `http://127.0.0.1:8765`. The Vite dev server (port 5173) proxies `/api`
to it, so the browser calls the same origin. In mock mode a playback-speed selector controls the
scripted event timing.

## API contract

Proposed contract, **not yet checked against a running backend** (no backend code was available).
Typed source: `src/api/types.ts`. Readable copy with example payloads: `docs/api-contract.md`.
Summary: `GET /api/agents`, `GET /api/scenarios`, `POST /api/runs`, `GET /api/runs/{id}/events` (SSE),
`GET /api/runs/{id}` (result bundle). Additions to the brief are listed in the contract file
(`ts` on every event, `depends_on` on agents, `options` on select controls, the result bundle shape).

## Honesty rules in the UI

- No number is shown unless it is in the API data. Missing values are the hatched word "unknown".
- A permanent footer states: Advisory only. A human decides. No automatic action is authorised.
- "recommended" / "approved" appear only if the API field says so.
- `human_decision_required`, `automatic_action_authorized`, `equipment_condition_confirmed` are shown as given.
- Agent errors and runner rejections are red and carry the issue code.

Each rule has tests in `tests/honesty.test.tsx`.

## Brand assets

`npm run assets` runs `scripts/process_brand_assets.py` (Python + Pillow). It reads the source
images in the repo root without modifying them and writes UI versions to `public/brand/`
(trimmed logo, sphere mark, favicon, six cropped role icons, hero image). The concept image is a
layout reference only and is not shipped.

## Screenshots

```bash
npm run screenshots
```

Starts the dev server in mock mode on port 5199, runs each scenario at 1920x1080 in headless Google
Chrome (override the path with `CHROME_PATH`) and writes `screenshots/NN-<scenario>.png`.

## Dependencies

Runtime: `react`, `react-dom`, `@fontsource/michroma` (wordmark and labels), `@fontsource/inter` (body).
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`,
`vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`,
`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`,
`playwright-core` (screenshots only; uses the installed Chrome, no browser download).
