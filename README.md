# Simple Mind Map App

A simple, free, **100% client-side mind mapping app** — brainstorm, organize ideas, and visualize hierarchies on an infinite-ish canvas in your browser. No accounts, no backend, no data leaves your machine. Built with Next.js and Tailwind CSS; originally scaffolded with v0.app and hardened for static hosting.

> Built by Girish Lade — https://ladestack.in

**Live demo:** https://girishlade111.github.io/simple-mind-map-app/

## What it does

Start with a "Main Idea" root node and grow a tree of ideas around it:

- **Add nodes** — select any node and press the `+` button (or add children to any node)
- **Edit inline** — double-click (or click the edit affordance) to rename any node
- **Drag nodes** — reposition nodes freely on the canvas; connecting curves follow automatically
- **Delete nodes** — removes the node and its whole subtree
- **Undo / Redo** — full history stack for node changes
- **Zoom & pan** — zoom in/out buttons plus click-drag panning of the canvas
- **Export to JSON** — downloads your mind map as a nested JSON file (`mindmap-<date>.json`)
- **Import from JSON** — paste or load a JSON file to restore a previously exported map
- **Color-coded levels** — each tree depth gets its own gradient color (blue, purple, green, orange, pink)
- **Auto layout** — children are automatically positioned around their parent with balanced spacing

## Tech stack

| Layer      | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router, static export) |
| UI        | React 19, Tailwind CSS 3.4, shadcn/ui Button |
| Icons     | lucide-react |
| Fonts     | Geist (bundled `geist` package) |
| Rendering | SVG connection curves + absolutely positioned HTML nodes |
| Export     | `html2canvas` (available for PNG capture) |

## Quick start

```bash
# install dependencies (pnpm preferred; npm works too)
pnpm install

# run the dev server
pnpm dev        # http://localhost:3000

# build a static production bundle
pnpm build     # output goes to ./out

# preview the static bundle
npx serve out
```

### npm alternative

```bash
npm install --legacy-peer-deps
npm run build
```

## Project structure

```
app/
  page.tsx            # The whole mind map app (canvas, nodes, toolbar, history)
  layout.tsx          # Root layout + Geist fonts + Vercel Analytics
  globals.css         # Tailwind base styles
components/
  ui/button.tsx       # shadcn/ui Button
  theme-provider.tsx  # next-themes wrapper
lib/
  utils.ts            # cn() class-name helper
public/               # Static assets
next.config.mjs       # Static export config (output: 'export')
```

## JSON format

Exported maps use a simple nested format, so you can hand-author or generate maps programmatically:

```json
{
  "name": "Main Idea",
  "children": [
    { "name": "Branch one" },
    { "name": "Branch two", "children": [{ "name": "Leaf" }] }
  ]
}
```

## Environment variables

None required — the app is fully static and needs no secrets.

## Deployment

The site is a static export, so it can be hosted anywhere that serves static files:

- **GitHub Pages** (current): the `gh-pages` branch is deployed automatically and served at `https://girishlade111.github.io/simple-mind-map-app/`. Because the site lives under a sub-path, `next.config.mjs` sets `basePath: '/simple-mind-map-app'`. **If you deploy to a root domain or Vercel, remove the `basePath` setting** before building.
- **Vercel / Netlify / Cloudflare Pages**: connect the repo and build with `pnpm build` (publish directory `out/` for Pages).

## Security note

Next.js is pinned to 15.2.8 (patched for CVE-2025-55182 React2Shell and related 15.2.x advisories).
