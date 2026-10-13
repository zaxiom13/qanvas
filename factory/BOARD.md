# Qanvas board

Reconciled 2026-10-13 (Europe/London). `main` is `29569f2` (merge of #45). One new improvement draft is open. Two older drafts were updated so they merge again. Nothing here is a commitment until a card says shipped and the PR is merged.

## This run

| PR | State | What a learner gets |
| --- | --- | --- |
| [#53](https://github.com/zaxiom13/qanvas/pull/53) | Open draft | On a phone held sideways, sketch code and the drawing sit side by side, and a drawing problem is not squeezed into a sliver |

[#41](https://github.com/zaxiom13/qanvas/pull/41) was left as it was. It still merges into `main`, and its three progress tests pass once `fake-indexeddb` is installed.

[#42](https://github.com/zaxiom13/qanvas/pull/42) and [#44](https://github.com/zaxiom13/qanvas/pull/44) did not merge: `StudioView.svelte` and the reference blurb had both changed. Each now contains a merge of `main`. #42 keeps the share-preview imports and the deleted-sketch helpers. #44 keeps the line-split `vs` blurb and the `sv` blurb already on `main`. Check 0 errors, 2 warnings. #42: 20 files, 1422 passed. #44: 20 files, 1421 passed.

[#46](https://github.com/zaxiom13/qanvas/pull/46) is closed and was never merged. Its 2026-10-11 journal is in this branch. Do not merge #46 as-is. It would put the older board back.

## Already on main since the 2026-10-12 board

The board merged in #52 was written before these landed. They are on `main` now:

| PR | What a learner gets |
| --- | --- |
| [#40](https://github.com/zaxiom13/qanvas/pull/40) | Deploy path is Cloudflare Workers Builds. A human merged this. Night runs still do not deploy. |
| [#43](https://github.com/zaxiom13/qanvas/pull/43) | My sketches has Duplicate. The copy does not keep the share key. |
| [#45](https://github.com/zaxiom13/qanvas/pull/45) | Importing the same sketch backup again does not add another copy. |
| [#47](https://github.com/zaxiom13/qanvas/pull/47) | A wildcard `ss` stops with `'stop` when the run budget is spent. |
| [#48](https://github.com/zaxiom13/qanvas/pull/48) | A `cross` that would build more than 8,000,000 pairs stops with `'limit`. |
| [#49](https://github.com/zaxiom13/qanvas/pull/49) | `` ` sv `` joins lines. `0b sv` turns 8, 16, 32 or 64 bits into an integer. |
| [#50](https://github.com/zaxiom13/qanvas/pull/50) | Opening a share link shows the sketch name and a picture drawn on the device. |
| [#51](https://github.com/zaxiom13/qanvas/pull/51) | Dragging the mini canvas keeps it on screen. |
| [#52](https://github.com/zaxiom13/qanvas/pull/52) | The 2026-10-12 board. |

This run did not merge, push to `main`, or deploy.

## Still open from earlier nights

| PR | State | What a learner gets |
| --- | --- | --- |
| [#41](https://github.com/zaxiom13/qanvas/pull/41) | Open draft, merges | Lesson and Dojo progress saved in two tabs at once is kept |
| [#42](https://github.com/zaxiom13/qanvas/pull/42) | Open draft, updated | Deleting the open sketch, or reloading a deleted id, opens a sketch that still exists |
| [#44](https://github.com/zaxiom13/qanvas/pull/44) | Open draft, updated | `` ` vs `` splits lines. A base below 2 raises `'domain` instead of hanging |

#42 edits `StudioView.svelte` and `Gallery.svelte`. #53 also edits `StudioView.svelte`. Merging both needs a small combine. #41 edits `package.json` (devDependency `fake-indexeddb` only) and `src/lib/storage.ts`.

## Roadmap

1. **Installability — shipped (#28), unchanged.** Real PNGs from `tools/make-icons.mjs`. Not done: a real Android install, an iOS home-screen check, Lighthouse.
2. **Offline — not retested this run.** Precache on `main` at `29569f2` is 22 entries, 2502.90 KiB. Not done: an `autoUpdate` swap mid-session over an unsaved edit.
3. **Saved work — #43 and #45 are merged. #41 and #42 are still open.** Flush on switch, hide and `pagehide` is merged. Sketch JSON backup and duplicate are merged. Not done: a progress schema version, or backup of lesson and Dojo progress.
4. **Portrait and landscape — #30 and #51 are merged. #53, open, is the short wide layout.** 844×390 was the desktop studio: a small canvas, no symbol bar, and a drawing problem 124px wide. After #53 the sketch is side by side (canvas 280×280, symbol bar present) and the checkerboard problem is 464px beside its picture. Portrait 390×844 and desktop 1280×800 were unchanged. A phone still under 760px wide (667×375) stays on the stacked phone UI. Not done: a physical notch, the soft keyboard, and keeping the same canvas instance across a rotation (the sketch restarts).
5. **Main-thread responsiveness — #34, #47 and #48 are merged.** Lists over 8,000,000 items are `'limit`. A wildcard `ss` checks the run budget. `cross` uses the same cap. A Worker is still only a proposal.
6. **Bundle — measured, not split.** One JS chunk on `main`: 2,160.88 kB (gzip 668.89 kB). CSS 52.19 kB (gzip 12.26 kB). #53 is 2,161.66 kB (gzip 669.14 kB) and CSS 53.00 kB (gzip 12.40 kB). No code splitting.
7. **Android wrapper — parked.** Not confirmed. PWA installability is the committed goal. Do not start a TWA/WebView shell until Zak confirms or the PWA milestones above are done.

## Feature cards

### Phone landscape layout — in progress

- **This run:** [#53](https://github.com/zaxiom13/qanvas/pull/53), open. A window at most 500px tall and 761–1024px wide uses a landscape studio and a two-column drawing problem.
- **Evidence:** `test/viewport.test.ts`. Headless Chrome, light theme, live re-run off. Before and after at 844×390 for the sketch and the checkerboard. Portrait, desktop, 1400×420, 667×375, 932×430, and a dark 844×390 sketch were also opened. No page errors. Tapping a backtick on the symbol bar inserted it. The console opened as a drawer. Rotating 390×844 to 844×390 left the sketch running (Restart, 60 fps).
- **Rough edges:** the stage is a new instance after rotation, so the animation starts again. The symbol bar scrolls. Dimensions on the canvas toolbar hide when the bar is under 360px. No physical phone.
- **Next iterations:**
  1. Exercise the soft keyboard over the symbol bar and the editor.
  2. Keep one stage instance across rotation so a running sketch does not restart.
  3. Use the side-by-side studio for a short phone that is still under 760px wide.

### F7 Share polish — in progress, no new increment this run

- **Shipped:** increment 1, [#31](https://github.com/zaxiom13/qanvas/pull/31), merged. Opening `#/s/…` reuses an unedited copy.
- **Shipped:** increment 2, [#36](https://github.com/zaxiom13/qanvas/pull/36), merged. URLs longer than 8,000 characters ask before they are copied.
- **Shipped:** increment 3, [#50](https://github.com/zaxiom13/qanvas/pull/50), merged. Opening a link shows the name and a 44px thumbnail.
- **Rough edges:** the thumbnail can arrive after the name. 8,000 is still a local guess.
- **Next iterations:**
  1. A QR code for phone hand-off, generated locally, no remote service.
  2. Revisit 8,000 if a real chat-app measurement says the line is wrong.
  3. Let the learner hide the arrival bar and remember that choice.

### F1 Sketch library management — in progress, no new increment this run

- **Shipped:** increment 1, [#38](https://github.com/zaxiom13/qanvas/pull/38), merged. Export and import of sketches as JSON.
- **Shipped:** increment 2, [#43](https://github.com/zaxiom13/qanvas/pull/43), merged. Duplicate.
- **Shipped:** increment 3, [#45](https://github.com/zaxiom13/qanvas/pull/45), merged. A second import of the same id, name and code is skipped.
- **Open:** [#42](https://github.com/zaxiom13/qanvas/pull/42) still covers a deleted `lastSketch`. It edits `Gallery.svelte`.
- **Rough edges:** Duplicate stacks the prefix (`Copy of Copy of …`). Import identity ignores thumbnail-only changes. Lesson and Dojo progress are not in the file.
- **Next iterations:**
  1. Filter My sketches by name, after #42 has merged. #42 and a filter both edit `Gallery.svelte`.
  2. Number copies so the name does not become `Copy of Copy of …`.
  3. Include lesson and Dojo progress in a backup, additively, without wiping what is already stored.

### Not started

| Card | Why it waited |
| --- | --- |
| F2 Animated export | Bundle cost unknown; encoder must be lazy and precached. |
| F3 Dojo: dictionaries, qSQL, temporals, strings | Needs real-q or cited semantics per problem. |
| F4 Learn progress: chapter badges, resume cell, reset lesson | Must not wipe `done` / saved answers. #41 only stops two tabs dropping updates. |
| F5 Reference: open in Sketch, lesson/Dojo backlinks | |
| F6 Editor: hover docs, signature hints, shortcuts sheet | |
| F8 Onboarding | Keep it to a dismissible empty state. No tour. |
| F9 New examples and lessons | Each must pass the existing content suites. |

## Refinement cards

### R4 Empty and edge states — partial

A failed share decode toasts (#31, merged). #42, open, covers `lastSketch` and a route id pointing at a deleted sketch. Still open: an empty gallery beyond the copy already there, and a screen for no saved lesson progress.

### Not started

R1 error and stop copy. R2 micro-interactions. R3 visual consistency. R5 terminology sweep. README still says "number scrubbing", which `1b8e47e` removed. `tools/` still has scratch files (`t.ts`, `t2.ts`, `t3.ts`, `probe1.txt`, `q2.txt`, `typetable.txt`); not deleted, usage not confirmed. The two `state_referenced_locally` warnings are unchanged. No AGENTS.md.

## Draw

Seed `20261013`. One draw:

```python
random.Random(20261013).choices(
    ["features", "refinement", "q parity", "mobile", "content", "performance", "accessibility", "docs"],
    weights=[20, 15, 20, 12, 10, 10, 8, 5],
    k=1,
)
```

Result: **mobile**. That slot is #53.

The same call returns mobile for `20261009`, q parity for `20261010`, q parity for `20261011`, and q parity for `20261012`, which matches those journals.

This run did not open five new PRs. The instruction for the night was to avoid another pile of drafts and to put phone landscape first. The other slots were not used. #42 and #44 were repaired instead of replaced.

## Parked on purpose

- v1 branches and closed PRs #10, #16, #18, #20–#23. No merge base with `main`. Not rebased, not revived.
- Android shell. See roadmap 7.
- Interpreter Worker. Guards inside the primitives are on `main`. A Worker stays a proposal.
- Spaced boolean vectors such as `where 0 1 1 0 1b`. Do not change the lexer.
- `ssr` still replaces non-overlapping copies.
- `0N=0N` stays `1b`.
- `0x0 sv` (bytes to an integer). Not changed.
- Merging #46 on top of this board. Combine by keeping this file.
