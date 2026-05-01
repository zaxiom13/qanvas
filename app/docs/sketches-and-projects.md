# Sketches and projects

## What gets saved

A **project** (sketch) is a bundle of:

- **Display name** (`projectName`) — what you see in the toolbar and project library.
- **`projectPath`** — stable id for storage. In the web app this is a virtual path such as `browser://projects/<slug>-<id>` stored in **localStorage** (per browser profile).
- **Files** — `.q` sources (e.g. `sketch.q`) and the **active** file name.
- **Assets** — imported images referenced from the sketch.

Renaming the project in the UI updates the **name** immediately; once the sketch **saves** (manual save or autosave after edits when a path already exists), the library row shows the new title.

## Where it persists

| Environment | Storage |
|-------------|---------|
| Web / PWA (`installBrowserAPI`) | `localStorage` keys: project index `qanvas5:browser:projects:index`, each project under `qanvas5:browser:project:` + encoded path |
| Electron (when wired) | Depends on packaged `browserAPI` / filesystem bridge |

The Projects modal explains this in plain language; internal `browser://` paths are summarized as “this browser / this device” where that reads better than a long URI.

## UX entry points

- **Desktop:** Toolbar — **New sketch** (+), project name (rename), unsaved dot, folder opens the library modal; **Cmd/Ctrl+N** / **Cmd/Ctrl+S** in the editor. Examples modal uses a scrollable flex layout so the grid stays visible under the category row.
- **Mobile (Studio):** Bottom nav **Library** — full-screen list, **New**, and the same cards as the desktop projects modal; header chip still renames the current sketch. **Settings → Save & open** includes jumping to the Library tab. **Practice** mode hides the Library tab (no saved projects there). Editor **Cmd/Ctrl+S** still saves when the editor is focused.

## Tab title

The document title follows `App.svelte`: studio mode uses `«name» (unsaved) · Qanvas5` when dirty; practice mode uses the lesson title.
