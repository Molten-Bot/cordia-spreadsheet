# Spreadsheet

Static browser-only 1024 x 1024 spreadsheet that stores one working sheet in browser local storage, evaluates basic formulas, and exports CSV or JSON files.

## Structure

- `public/index.html` - spreadsheet markup and deploy entry point
- `public/global.css` - global styling
- `src/app.ts` - typed browser-only application source
- `public/app.js` - compiled browser application logic
- `public/_redirects` - Cloudflare Pages SPA fallback
- `public/_headers` - basic static security headers

## Run locally

Install dependencies, compile TypeScript, then serve the `public` folder with any static file server:

```sh
npm install
npm run build
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Deploy on Cloudflare Pages

Use these project settings:

- Build command: `npm run build`
- Build output directory: `public`

Spreadsheet does not require bundling, server functions, accounts, or a database.
