# Verum demo frontend

Single-page demo UI for the Verum multi-agent industrial diagnostic pipeline.
Advisory only: a human decides, and no automatic action is authorised.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (mock data if no backend is reachable)
npm run build
npm run test
npm run lint
npm run typecheck
```

More detail (API modes, contract, screenshots) is added as the app grows.

## Brand assets

`npm run assets` runs `scripts/process_brand_assets.py` (Python + Pillow). It reads the
source images in the repo root without modifying them and writes the UI versions to
`public/brand/` (trimmed logo, sphere mark, favicon, six cropped role icons, hero image).
