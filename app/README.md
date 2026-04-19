# Qanvas5JS

Browser-first Qanvas5 with the jqport JS engine wired in locally.

## Requirements

- Node.js 20+
- Access to the local jqport checkout at `/Users/zak1726/Desktop/remoteaccess/jqport`

## Install

```bash
npm install
```

## Scripts

- `npm run dev` - start the Vite dev server on `127.0.0.1:4173`
- `npm run build` - build the browser app
- `npm run preview` - preview the production build locally
- `npm run check` - run Svelte type checking

## Notes

- `@qpad/core` and `@qpad/engine` are linked from the local jqport workspace with `file:` dependencies.
- The app is intended to run entirely in the browser; Electron-specific scripts are no longer part of the primary workflow.

