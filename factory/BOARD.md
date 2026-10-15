# Qanvas board

Reconciled 2026-10-15 (Europe/London). `main` is `e4dcfbb` (merge of #53). Five improvement drafts from this run are open. #41, #42, #44 and the 2026-10-14 drafts #55–#59 were not edited. Nothing here is a commitment until a card says shipped and the PR is merged.

[#60](https://github.com/zaxiom13/qanvas/pull/60) is the 2026-10-14 board. [#54](https://github.com/zaxiom13/qanvas/pull/54) is the 2026-10-13 board. Do not merge either on top of this file. This PR carries `factory/journal/2026-10-11.md`, `factory/journal/2026-10-13.md` and `factory/journal/2026-10-14.md`, which otherwise exist only on those drafts.

## This run

| PR | State | What a learner gets |
| --- | --- | --- |
| [#61](https://github.com/zaxiom13/qanvas/pull/61) | Open draft | A long `sums`, `avgs`, `group`, `distinct` or sort stops when the run budget is spent |
| [#62](https://github.com/zaxiom13/qanvas/pull/62) | Open draft | `.Q.fmt` wider than 8,000,000 characters is `'limit`. A negative width is `'domain` |
| [#63](https://github.com/zaxiom13/qanvas/pull/63) | Open draft | Duplicating a copy is named "Copy 2 of …", not "Copy of Copy of …" |
| [#64](https://github.com/zaxiom13/qanvas/pull/64) | Open draft | A failed check says "Not yet". A solved problem says "solved" |
| [#65](https://github.com/zaxiom13/qanvas/pull/65) | Open draft | Muted text and the pass, fail and warning colours clear 4.5:1 |

## Still open from earlier nights

| PR | State | What a learner gets |
| --- | --- | --- |
| [#41](https://github.com/zaxiom13/qanvas/pull/41) | Open draft | Lesson and Dojo progress saved in two tabs at once is kept |
| [#42](https://github.com/zaxiom13/qanvas/pull/42) | Open draft | Deleting the open sketch, or reloading a deleted id, opens a sketch that still exists |
| [#44](https://github.com/zaxiom13/qanvas/pull/44) | Open draft | `` ` vs `` splits lines. A base below 2 raises `'domain` instead of hanging |
| [#55](https://github.com/zaxiom13/qanvas/pull/55) | Open draft | A string pad wider than 8,000,000 characters stops with `'limit` |
| [#56](https://github.com/zaxiom13/qanvas/pull/56) | Open draft | The shell follows the visual viewport, so a keyboard can lift the symbol bar |
| [#57](https://github.com/zaxiom13/qanvas/pull/57) | Open draft | My sketches can be filtered by name |
| [#58](https://github.com/zaxiom13/qanvas/pull/58) | Open draft | The Dojo has four dictionary problems |
| [#59](https://github.com/zaxiom13/qanvas/pull/59) | Open draft | Phone icon buttons have an accessible name |

`git merge-tree --write-tree` of #61 with #44 and with #55 exits 0. #64 with #65 exits 0. They were not re-tested as a combined tree. #63 edits `sketchCopy.ts` only, not `Gallery.svelte`. #57 and #42 still edit the gallery. #59 edits icon names on App, Stage and Studio. #64 does not.

#40 (Workers Builds) is merged. A push to `main` still deploys. Do not merge from a night run.

## Roadmap

1. **Installability — shipped (#28), unchanged.** Real PNGs from `tools/make-icons.mjs`. Not done: a real Android install, an iOS home-screen check, Lighthouse.
2. **Offline — not retested tonight.** Precache on `main` at `e4dcfbb` is 22 entries, 2504.46 KiB. Not done: an `autoUpdate` swap mid-session over an unsaved edit.
3. **Saved work — #41 and #42 still open.** #63 only changes the name of a duplicate. Not done: a progress schema version, or backup of lesson and Dojo progress.
4. **Portrait and landscape — #53 is on `main`. #56 is still open.** No layout change tonight. A physical keyboard and a notch were not tested. Rotation still remounts the stage.
5. **Main-thread responsiveness — #61, open, checks the deadline inside list scans and sorts. #62, open, caps `.Q.fmt`.** #55, still open, caps string pad. A Worker is still only a proposal.
6. **Bundle — measured, not split.** One JS chunk on `main`: 2,161.66 kB (gzip 669.14 kB). The largest branch tonight is #63 at 2,161.94 kB (gzip 669.27 kB). #65 does not change the JS chunk. No code splitting.
7. **Android wrapper — parked.** Not confirmed. PWA installability is the committed goal. Do not start a TWA/WebView shell until Zak confirms or the PWA milestones above are done.

## Feature cards

### F1 Sketch library management — in progress

- **Shipped:** increment 1, [#38](https://github.com/zaxiom13/qanvas/pull/38), merged. Export and import of sketches as JSON.
- **Shipped:** increment 2, [#43](https://github.com/zaxiom13/qanvas/pull/43), merged. Duplicate.
- **Shipped:** increment 3, [#45](https://github.com/zaxiom13/qanvas/pull/45), merged. A second import of the same id, name and code is skipped.
- **Open from 2026-10-14:** increment 4, [#57](https://github.com/zaxiom13/qanvas/pull/57). Filter My sketches by name.
- **This run:** increment 5, [#63](https://github.com/zaxiom13/qanvas/pull/63), open. The name counts "Copy of" and "Copy N of" instead of stacking them. It does not read the rest of the library, so duplicating "Rings" twice still yields two sketches named "Copy of Rings".
- **Evidence:** `test/sketchCopy.test.ts`. Headless Chrome, light theme, phone 390×844 and desktop 1280×800. The sketch was renamed to "Copy of Rings" and duplicated.
- **Rough edges:** the gallery toast still says the name that was duplicated, not the new name. #57's filter is unmerged, so the tab count while filtering was not touched.
- **Next iterations:**
  1. When the original is duplicated twice, pick the next free "Copy N" by looking at names already saved.
  2. Show the filtered count on the tab, after #57 has merged.
  3. Include lesson and Dojo progress in a backup, additively, after #41 has merged. Both would edit progress storage.

### F3 Dojo expansion — in progress, no new increment this run

- **Open:** increment 1, [#58](https://github.com/zaxiom13/qanvas/pull/58). Four dictionary problems. Left as it was. A qSQL set would stack on that unmerged increment.
- **Next iterations:** qSQL, then temporals, then strings and symbols. A few problems at a time, cited the same way #58 cites code.kx.com.

### F7 Share polish — in progress, no new increment this run

- **Shipped:** [#31](https://github.com/zaxiom13/qanvas/pull/31) reuses an unedited copy. [#36](https://github.com/zaxiom13/qanvas/pull/36) warns past 8,000 characters. [#50](https://github.com/zaxiom13/qanvas/pull/50) shows the name and a thumbnail.
- **Next iterations:** a local QR code, revisit 8,000 if a chat app is measured, remember a dismissed arrival bar.

### Kept, not started this run

F4 resume cell and reset lesson. Must not wipe `done` or saved answers. #41 is the unmerged progress write path.

F6 hover docs already exist. Still missing: signature hints for draw calls, and an in-app shortcuts sheet.

### Parked again (keep parked)

These were parked on 2026-10-14. No new evidence tonight, so they stay parked.

- **F2 Animated export.** The JS chunk is 2.16 MB. Park until a lazy encoder is measured against the precache.
- **F5 Reference backlinks.** "Try in the console" already exists. Park while F1 and F3 have open next iterations.
- **F8 Onboarding tour.** Park. A tour caused z-index and keyboard bugs in v1.
- **F9 New lessons.** Park until the Dojo sets for the existing chapters exist. #58 is still open.
- **R2 Micro-interactions.** Park. `prefers-reduced-motion` is already global. No timing bug was reproduced.

### R3 Visual consistency — partial

[#65](https://github.com/zaxiom13/qanvas/pull/65), open. Light muted text, pass, fail and warning clear 4.5:1. Dark muted text does too. Not done: syntax comments (3.0:1 on the light code background), light type-number and type-float chips, and a full spacing pass. Screenshots are on #65.

### R4 Empty and edge states — partial

A failed share decode toasts (#31, merged). #42, open, covers a route id pointing at a deleted sketch. Still open: a screen for no saved lesson progress.

### R5 Copy — not started

README still says "number scrubbing", which `1b8e47e` removed. #58, open, is the draft that changes the Dojo count from 33 to 37. `tools/` still has scratch files (`t.ts`, `t2.ts`, `t3.ts`, `probe1.txt`, `q2.txt`, `typetable.txt`). Not deleted. Usage not confirmed. The two `state_referenced_locally` warnings are unchanged. No AGENTS.md.

### R1 Error copy — not started

`'stop` still says "Execution was interrupted" in `ERROR_HELP`, and `explainError` clears that help so the budget hint is what the card shows. Left for a later pass.

## Accessibility

[#64](https://github.com/zaxiom13/qanvas/pull/64), open. Check lines say "Passed" or "Not yet", and the result is a status region. Solved rows in Learn and Dojo include the word "solved". [#59](https://github.com/zaxiom13/qanvas/pull/59), still open, names the phone icon buttons. [#65](https://github.com/zaxiom13/qanvas/pull/65) is the contrast measurement. Not done: a screen reader on a device, a text alternative for the drawing beyond "Sketch canvas".

## Draw

Seed `20261015`. One draw:

```python
random.Random(20261015).choices(
    ["features", "refinement", "q parity", "mobile", "content", "performance", "accessibility", "docs"],
    weights=[20, 15, 20, 12, 10, 10, 8, 5],
    k=1,
)
```

Result: **accessibility**. That slot is #64. The same call returns mobile for `20261009`, q parity for `20261010`, q parity for `20261011`, q parity for `20261012`, mobile for `20261013`, and content for `20261014`, which matches those journals.

Slots this run: reliability (#61 list scans), reliability (#62 `.Q.fmt`), feature F1 increment 5 (#63), accessibility (#64 check words), accessibility (#65 contrast, because the ratios were already measured and warn was under 3:1). No feature slot was displaced.

## Parked on purpose

- v1 branches (`cursor/*` from before the 2026-09-27 rewrite, closed PRs #10, #16, #18, #20–#23). No merge base with `main`. Not rebased, not revived.
- Android shell. See roadmap 7.
- Interpreter Worker. The caps and the deadline checks stay inside the primitives. A Worker stays a proposal.
- Spaced boolean vectors such as `where 0 1 1 0 1b`. Do not change the lexer.
- `ssr` still replaces non-overlapping copies.
- `0N=0N` stays `1b`. Do not "fix" null equality.
- `0x0 sv`. Not changed.
- #54 and #60. Superseded by this board. Do not merge them.
