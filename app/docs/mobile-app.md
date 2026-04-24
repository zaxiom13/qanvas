# qanvas5 Mobile App Direction

## Recommendation

Use the existing Svelte/Vite UI as the shared product surface, then package it with Capacitor for iOS and Android.

Svelte Native is still a real option through NativeScript, but it uses NativeScript view primitives instead of browser DOM elements. That means the editor, canvas, examples grid, app state, and styling would need a parallel UI layer. Capacitor keeps the UI code closest to the web app while still leaving room for native plugins later.

## Product Shape

The mobile app should be a focused creative coding cockpit:

- **Editor**: full-height code editor, compact file tab, run controls in the top action strip, console as a bottom sheet.
- **Canvas**: immersive sketch preview, large run/stop/snapshot controls, quick tools in a draggable lower sheet.
- **Examples**: searchable gallery with thumb-friendly category filters and a bottom tab entry point.
- **Data**: table/array inspection and runtime output, kept separate from the editor so small screens do not become cramped.
- **Settings**: runtime, display, exports, sync, and account/preferences.

## Navigation

Use a persistent bottom navigation bar:

- Editor
- Canvas
- Examples
- Data
- Settings

The nav should use large icon targets, a raised active state, and iOS safe-area padding. Primary actions stay near the thumb zone unless they are playback controls, which can also sit in the top action strip like the reference.

## Visual Rules

Keep the current webapp theme instead of copying the reference image's neon-dark skin:

- Use the warm qanvas5 surfaces from `app/styles.css`.
- Keep qanvas5 blue and clay-gold as brand anchors.
- Use magenta sparingly for active sketch/run moments and creative affordances.
- Keep corners tighter than typical mobile apps: 6-8px for cards/sheets, not fully pill-shaped except for tiny status dots.
- Let sketch thumbnails and canvas output provide the saturated color.

## Implementation Plan

1. Add a mobile shell component that consumes existing `appState`.
2. Swap the root layout into the mobile shell behind a viewport/device flag or dedicated mobile entry.
3. Replace Monaco with a mobile-friendly editor strategy where needed:
   - Start with Monaco on tablets and large phones.
   - Evaluate CodeMirror 6 for better phone editing.
4. Package with Capacitor:
   - `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli`.
   - Set `webDir` to the Vite build output.
   - Add native safe-area handling and filesystem/export plugins.
5. Move q runtime execution behind the existing browser/runtime adapter boundary so mobile can run compiled JS first and optionally call native/plugin-backed runtimes later.

## First Prototype

`app/src/lib/mobile/MobileShell.svelte` is the initial UI shell. It is intentionally additive and not wired into `App.svelte` yet, so it can be iterated without disturbing the desktop workspace.
