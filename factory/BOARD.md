# Qanvas board

Reconciled 2026-10-14 (Europe/London). `main` is `e4dcfbb` (merge of #53). Five improvement drafts from this run are open. #41, #42 and #44 are still open and were not edited. Nothing here is a commitment until a card says shipped and the PR is merged.

[#54](https://github.com/zaxiom13/qanvas/pull/54) is the 2026-10-13 board. It still says #53 is open. #53 is merged. Do not merge #54 on top of this file. This PR carries `factory/journal/2026-10-11.md` and `factory/journal/2026-10-13.md`, which otherwise exist only on #54.

## This run

| PR | State | What a learner gets |
| --- | --- | --- |
| [#55](https://github.com/zaxiom13/qanvas/pull/55) | Open draft | A string pad wider than 8,000,000 characters stops with `'limit` |
| [#56](https://github.com/zaxiom13/qanvas/pull/56) | Open draft | The shell follows the visual viewport, so a keyboard can lift the symbol bar |
| [#57](https://github.com/zaxiom13/qanvas/pull/57) | Open draft | My sketches can be filtered by name |
| [#58](https://github.com/zaxiom13/qanvas/pull/58) | Open draft | The Dojo has four dictionary problems |
| [#59](https://github.com/zaxiom13/qanvas/pull/59) | Open draft | Phone icon buttons have an accessible name |

## Still open from earlier nights

| PR | State | What a learner gets |
| --- | --- | --- |
| [#41](https://github.com/zaxiom13/qanvas/pull/41) | Open draft | Lesson and Dojo progress saved in two tabs at once is kept |
| [#42](https://github.com/zaxiom13/qanvas/pull/42) | Open draft | Deleting the open sketch, or reloading a deleted id, opens a sketch that still exists |
| [#44](https://github.com/zaxiom13/qanvas/pull/44) | Open draft | `` ` vs `` splits lines. A base below 2 raises `'domain` instead of hanging |

`git merge-tree --write-tree` of each of those three onto `e4dcfbb` exits 0. They were not re-tested in the browser tonight. #42 edits `Gallery.svelte` `remove` and `StudioView.svelte` route loading. #57 edits the gallery filter, not `remove`. #59 edits the Examples and My sketches buttons, not route loading.

#40 (Workers Builds) is merged. A push to `main` still deploys. Do not merge from a night run.

Already on `main` since the 2026-10-12 board: #43 Duplicate, #45 import skip, #47 wildcard `ss`, #48 `cross` limit, #49 `` ` sv `` and `0b sv`, #50 share preview, #51 mini-canvas clamp, #53 phone landscape.

## Roadmap

1. **Installability — shipped (#28), unchanged.** Real PNGs from `tools/make-icons.mjs`. Not done: a real Android install, an iOS home-screen check, Lighthouse.
2. **Offline — not retested tonight.** Precache on `main` at `e4dcfbb` is 22 entries, 2504.46 KiB. Not done: an `autoUpdate` swap mid-session over an unsaved edit.
3. **Saved work — #41 and #42 still open, on top of #29 and #38.** Name filter (#57) does not change what Export writes. Not done: a progress schema version, or backup of lesson and Dojo progress.
4. **Portrait and landscape — #53 is merged. #56, open, sizes the shell from the visual viewport.** Phone 390×844 and 844×390 were opened again. With no keyboard the symbol bar is still on screen (733–784 in portrait, 339–390 in landscape). A simulated 430 px visual height lifts the bar on this branch and does not on `main`. A physical keyboard and a notch were not tested. Rotation still remounts the stage, so the animation starts over.
5. **Main-thread responsiveness — #34, #47 and #48 are merged. #55, open, caps string pad.** A Worker is still only a proposal.
6. **Bundle — measured, not split.** One JS chunk on `main`: 2,161.66 kB (gzip 669.14 kB). The largest branch tonight is #58 at 2,163.32 kB (gzip 669.73 kB). No code splitting.
7. **Android wrapper — parked.** Not confirmed. PWA installability is the committed goal. Do not start a TWA/WebView shell until Zak confirms or the PWA milestones above are done.

## Feature cards

### F1 Sketch library management — in progress

- **Shipped:** increment 1, [#38](https://github.com/zaxiom13/qanvas/pull/38), merged. Export and import of sketches as JSON.
- **Shipped:** increment 2, [#43](https://github.com/zaxiom13/qanvas/pull/43), merged. Duplicate. The copy does not keep the share key.
- **Shipped:** increment 3, [#45](https://github.com/zaxiom13/qanvas/pull/45), merged. A second import of the same id, name and code is skipped.
- **This run:** increment 4, [#57](https://github.com/zaxiom13/qanvas/pull/57), open. Filter My sketches by name. Export still saves every sketch.
- **Evidence:** `test/sketchFilter.test.ts`. Headless Chrome, light theme, phone 390×844 and desktop 1280×800. Sketches Rings, Orbits, ring study. Query `ring` keeps the two ring names.
- **Rough edges:** the tab count stays at the full library size while the filter is hiding cards. Duplicate still stacks `Copy of`. Lesson and Dojo progress are not in the backup.
- **Next iterations:**
  1. Number copies so the name does not become `Copy of Copy of …`.
  2. Show the filtered count, or "2 of 3", on the tab.
  3. Include lesson and Dojo progress in a backup, additively, without wiping what is already stored. Do this after #41 has merged or been combined, because both would edit progress storage.

### F3 Dojo expansion — in progress

- **This run:** increment 1, [#58](https://github.com/zaxiom13/qanvas/pull/58), open. Four dictionary problems. The Dojo is 37 problems in five sets.
- **Evidence:** `test/dojo.test.ts`. Cited from code.kx.com on 2026-10-14 (dicts and indexing, `+` on dictionaries, `count each group "mississippi"`). Not a KDB-X recording. Headless Chrome, phone and desktop, light theme.
- **Rough edges:** the guide screenshots still show the old list. They were not regenerated.
- **Next iterations:**
  1. A short qSQL set, cited the same way, a few problems at a time.
  2. Temporals, after qSQL or instead of it if a lesson check is found wrong.
  3. Strings and symbols.

### F7 Share polish — in progress, no new increment this run

- **Shipped:** increment 1, [#31](https://github.com/zaxiom13/qanvas/pull/31), merged. Opening `#/s/…` reuses an unedited copy.
- **Shipped:** increment 2, [#36](https://github.com/zaxiom13/qanvas/pull/36), merged. URLs longer than 8,000 characters ask before they are copied.
- **Shipped:** increment 3, [#50](https://github.com/zaxiom13/qanvas/pull/50), merged. Opening a link shows the name and a thumbnail drawn on the device.
- **Rough edges:** the thumbnail can arrive after the name. 8,000 is still a local guess.
- **Next iterations:**
  1. A QR code for phone hand-off, generated locally, no remote service.
  2. Revisit 8,000 if a real chat-app measurement says the line is wrong.
  3. Let the learner hide the arrival bar and remember that choice.

### F6 Editor — partly already there, not started as a card

Hover docs that show the reference summary are already in `src/editor/extensions.ts`. The guide mentions them. What is still missing is signature hints for draw calls and an in-app shortcuts sheet. Keep those two. Do not rebuild hover.

### Kept, not started this run

F4 resume cell and reset lesson. Must not wipe `done` or saved answers. #41 is the unmerged progress write path.

### Parked this run (untouched for more than three nights)

- **F2 Animated export.** Park until someone measures a lazy encoder against the precache. The JS chunk is already 2.1 MB. Not rejected.
- **F5 Reference backlinks.** Park while F1 and F3 have open next iterations. "Try in the console" already exists. Not rejected.
- **F8 Onboarding tour.** Park. A tour was a source of z-index and keyboard bugs in v1. A one-line empty state can come later. No tour.
- **F9 New lessons.** Park until the Dojo sets for the existing chapters exist. #58 is the content work.
- **R2 Micro-interactions.** Park. `prefers-reduced-motion` is already global. No timing bug was reproduced.
- **R3 Visual consistency.** Park until a contrast failure is measured in both themes. Not measured tonight.

### R4 Empty and edge states — partial

A failed share decode toasts (#31, merged). #42, open, covers a route id pointing at a deleted sketch. The empty gallery copy is already there. Still open: a screen for no saved lesson progress.

### R5 Copy — not started

README still says "number scrubbing", which `1b8e47e` removed. The Dojo count in the README and the guide was updated by #58 (33 to 37). `tools/` still has scratch files (`t.ts`, `t2.ts`, `t3.ts`, `probe1.txt`, `q2.txt`, `typetable.txt`). Not deleted. Usage not confirmed. The two `state_referenced_locally` warnings are unchanged. No AGENTS.md.

### R1 Error copy — not started

`'stop` still says "Execution was interrupted." The budget hint next to it is the longer sentence. Left for a later pass.

## Accessibility

[#59](https://github.com/zaxiom13/qanvas/pull/59), open. Console, Examples, My sketches, theme, and full view have accessible names on a phone. Not done: contrast in both themes, a screen reader on a device, a text alternative for the canvas.

## Draw

Seed `20261014`. One draw:

```python
random.Random(20261014).choices(
    ["features", "refinement", "q parity", "mobile", "content", "performance", "accessibility", "docs"],
    weights=[20, 15, 20, 12, 10, 10, 8, 5],
    k=1,
)
```

Result: **content**. That slot is #58. The same call returns mobile for `20261009`, q parity for `20261010`, q parity for `20261011`, q parity for `20261012`, and mobile for `20261013`, which matches those journals.

Slots this run: reliability (#55 string pad), reliability (#56 visual viewport), feature F1 increment 4 (#57), content (#58 dictionaries), accessibility (#59 icon names). No feature slot was displaced.

## Parked on purpose

- v1 branches (`cursor/*` from before the 2026-09-27 rewrite, closed PRs #10, #16, #18, #20–#23). No merge base with `main`. Not rebased, not revived.
- Android shell. See roadmap 7.
- Interpreter Worker. The caps stay inside the primitives. A Worker stays a proposal.
- Spaced boolean vectors such as `where 0 1 1 0 1b`. Do not change the lexer.
- `ssr` still replaces non-overlapping copies.
- `0N=0N` stays `1b`. Do not "fix" null equality.
- `0x0 sv`. Not changed.
- #54. Superseded by this board. Do not merge it.
