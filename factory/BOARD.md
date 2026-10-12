# Qanvas board

Reconciled 2026-10-12 (Europe/London) after the night run. `main` is `d06e761` (merge of #39). Five improvement PRs from this run are open drafts. Five improvement PRs from 2026-10-11 are still open drafts and were not edited. Nothing here is a commitment until a card says shipped and the PR is merged.

## This run

| PR | State | What a learner gets |
| --- | --- | --- |
| [#47](https://github.com/zaxiom13/qanvas/pull/47) | Open draft | A wildcard `ss` stops with `'stop` when the run budget is spent |
| [#48](https://github.com/zaxiom13/qanvas/pull/48) | Open draft | A `cross` that would build more than 8,000,000 pairs stops with `'limit` before it allocates |
| [#49](https://github.com/zaxiom13/qanvas/pull/49) | Open draft | `` ` sv `` joins lines. `0b sv` turns 8, 16, 32 or 64 bits into an integer |
| [#50](https://github.com/zaxiom13/qanvas/pull/50) | Open draft | Opening a share link shows the sketch name and a picture drawn on the device |
| [#51](https://github.com/zaxiom13/qanvas/pull/51) | Open draft | Dragging the mini canvas keeps it on screen |

## Still open from 2026-10-11

| PR | State | What a learner gets |
| --- | --- | --- |
| [#41](https://github.com/zaxiom13/qanvas/pull/41) | Open draft | Lesson and Dojo progress saved in two tabs at once is kept |
| [#42](https://github.com/zaxiom13/qanvas/pull/42) | Open draft | Deleting the open sketch, or reloading a deleted id, opens a sketch that still exists |
| [#43](https://github.com/zaxiom13/qanvas/pull/43) | Open draft | My sketches has Duplicate. The copy does not keep the share key |
| [#44](https://github.com/zaxiom13/qanvas/pull/44) | Open draft | `` ` vs `` splits lines. A base below 2 raises `'domain` instead of hanging |
| [#45](https://github.com/zaxiom13/qanvas/pull/45) | Open draft | Importing the same sketch backup again does not add another copy |

[#46](https://github.com/zaxiom13/qanvas/pull/46) is that night's board draft. This file is the later reconciliation. Merging #46 on top of this one would put the older text back; combine them instead of merging #46 as-is.

[#40](https://github.com/zaxiom13/qanvas/pull/40) is an open draft that switches deploy from GitHub Actions to Cloudflare Workers Builds. Not edited. Not merged. Merging it is a deploy-path change and stays a human decision. It edits `package.json`. #41 also edits `package.json` (devDependency `fake-indexeddb` only).

#42, #43 and #45 all edit `Gallery.svelte` in different functions. This run did not edit that file.

Already on `main`: 2026-10-09 [#28](https://github.com/zaxiom13/qanvas/pull/28) icons, [#29](https://github.com/zaxiom13/qanvas/pull/29) save flush, [#30](https://github.com/zaxiom13/qanvas/pull/30) landscape insets, [#31](https://github.com/zaxiom13/qanvas/pull/31) share-copy dedupe, [#32](https://github.com/zaxiom13/qanvas/pull/32) malformed hash. 2026-10-10 [#34](https://github.com/zaxiom13/qanvas/pull/34) huge-vector `'limit`, [#35](https://github.com/zaxiom13/qanvas/pull/35) pause when hidden, [#36](https://github.com/zaxiom13/qanvas/pull/36) share-length warning, [#37](https://github.com/zaxiom13/qanvas/pull/37) overlapping `ss`, [#38](https://github.com/zaxiom13/qanvas/pull/38) sketch JSON backup. This run did not merge, push to `main`, or deploy.

## Roadmap

1. **Installability — shipped (#28), unchanged.** Real PNGs from `tools/make-icons.mjs`. Not done: a real Android install, an iOS home-screen check, Lighthouse.
2. **Offline — spot-checked on 2026-10-09, not retested.** Precache on `main` at `d06e761` is 21 entries, 2498.17 KiB (hashed JS, CSS, woff2). The 512 px icons stay out of the precache. Not done: an `autoUpdate` swap mid-session over an unsaved edit.
3. **Saved work — increments from 2026-10-11 still open (#41, #42, #45), on top of #29 and #38.** Flush on switch, hide and `pagehide` is merged. Sketch JSON backup is merged. Not done: a progress schema version, or backup of lesson and Dojo progress.
4. **Portrait and landscape — #30 is merged. #51, open, keeps the mini canvas inside the editor.** Phone 390×844 and a short 700×400 viewport were exercised. A drag that used to land at (−51, −12) now stays inside. Not done: the layout still switches on `max-width: 760px` only, so 844×390 is the desktop layout and has no mini canvas. Soft keyboard and a physical notch were not tested.
5. **Main-thread responsiveness — #34 is merged. #47 and #48 are open.** Lists over 8,000,000 items are `'limit`. A wildcard `ss` now checks the run budget. `cross` uses the same cap and checks the budget while it fills. A Worker is still only a proposal.
6. **Bundle — measured, not split.** One JS chunk on `main`: 2,156.61 kB (gzip 666.49 kB). The largest branch this run is #51 at 2,158.00 kB (gzip 667.01 kB). No code splitting.
7. **Android wrapper — parked.** Not confirmed. PWA installability is the committed goal. Do not start a TWA/WebView shell until Zak confirms or the PWA milestones above are done.

## Feature cards

### F7 Share polish — in progress

- **Shipped:** increment 1, [#31](https://github.com/zaxiom13/qanvas/pull/31), merged. Opening `#/s/…` reuses an unedited copy. A damaged link toasts and falls back to `#/sketch`.
- **Shipped:** increment 2, [#36](https://github.com/zaxiom13/qanvas/pull/36), merged. URLs longer than 8,000 characters ask before they are copied.
- **This run:** increment 3, [#50](https://github.com/zaxiom13/qanvas/pull/50), open. Opening a link shows `Opened shared sketch “…”` and a 44 px thumbnail rendered on the device. Dismiss hides it. A later reload of the saved sketch does not show it again.
- **Evidence:** `test/share.test.ts`. Headless Chrome, light theme, live re-run off, phone 390×844 and desktop 1280×800. The sketch was `background 24` / `circle[center;90;\`coral]`.
- **Rough edges:** the thumbnail is one still from the local renderer and can arrive after the name. 8,000 is still a local guess. Not measured on a chat app.
- **Next iterations:**
  1. A QR code for phone hand-off, generated locally, no remote service.
  2. Revisit 8,000 if a real chat-app measurement says the line is wrong.
  3. Let the learner hide the arrival bar and remember that choice.

### F1 Sketch library management — in progress, no new increment this run

- **Shipped:** increment 1, [#38](https://github.com/zaxiom13/qanvas/pull/38), merged. Export downloads `qanvas-sketches.json`. Import adds sketches, remints a taken id, refuses a version other than 1, skips bad entries, and adds at most 500.
- **Open from 2026-10-11:** increment 2, [#43](https://github.com/zaxiom13/qanvas/pull/43), Duplicate. Increment 3, [#45](https://github.com/zaxiom13/qanvas/pull/45), a second import of the same id, name and code is skipped.
- **This run:** no new increment. A name filter would edit `Gallery.svelte`, which #42, #43 and #45 already edit and have not merged.
- **Rough edges:** Duplicate stacks the prefix (`Copy of Copy of …`). Import identity ignores thumbnail-only changes. Lesson and Dojo progress are not in the file.
- **Next iterations:**
  1. Filter My sketches by name, after #43 and #45 have merged or been combined.
  2. Number copies so the name does not become `Copy of Copy of …`.
  3. Include lesson and Dojo progress in a backup, additively, without wiping what is already stored.

### Not started

| Card | Why it waited |
| --- | --- |
| F2 Animated export | Bundle cost unknown; encoder must be lazy and precached. |
| F3 Dojo: dictionaries, qSQL, temporals, strings | Needs real-q or cited semantics per problem. |
| F4 Learn progress: chapter badges, resume cell, reset lesson | Chapter counts already render. Must not wipe `done` / saved answers. #41 only stops two tabs dropping updates. |
| F5 Reference: open in Sketch, lesson/Dojo backlinks | |
| F6 Editor: hover docs, signature hints, shortcuts sheet | |
| F8 Onboarding | Keep it to a dismissible empty state. No tour (v1 z-index bugs). |
| F9 New examples and lessons | Each must pass the existing content suites. |

## Refinement cards

### R4 Empty and edge states — partial

A failed share decode toasts (#31, merged). #42, open, covers `lastSketch` and a route id pointing at a deleted sketch. Still open: an empty gallery beyond the copy already there, and a screen for no saved lesson progress.

### Not started

R1 error and stop copy. R2 micro-interactions (`prefers-reduced-motion` is already global). R3 visual consistency, both themes. R5 terminology sweep. README still says "number scrubbing", which `1b8e47e` removed. `tools/` still has scratch files (`t.ts`, `t2.ts`, `t3.ts`, `probe1.txt`, `q2.txt`, `typetable.txt`); not deleted, usage not confirmed. The two `state_referenced_locally` warnings in `LessonCell.svelte` and `ChallengeCell.svelte` are unchanged. No AGENTS.md.

## Draw

Seed `20261012`. One draw:

```python
random.Random(20261012).choices(
    ["features", "refinement", "q parity", "mobile", "content", "performance", "accessibility", "docs"],
    weights=[20, 15, 20, 12, 10, 10, 8, 5],
    k=1,
)
```

Result: **q parity**. That slot is #49. Checked against the previous seeds: `20261009` is mobile, `20261010` is q parity, `20261011` is q parity, which matches those journals.

Slots this run: reliability (#47 wildcard `ss`), reliability (#48 `cross`), feature F7 increment 3 (#50), q parity (#49), reliability layout (#51 mini canvas). No feature slot was displaced.

## Parked on purpose

- v1 branches (`cursor/*` from before the 2026-09-27 rewrite, closed PRs #10, #16, #18, #20–#23). No merge base with `main`. Not rebased, not revived.
- Android shell. See roadmap 7.
- Interpreter Worker. #34, #47 and #48 are guards inside the primitives. A Worker stays a proposal.
- Spaced boolean vectors such as `where 0 1 1 0 1b`. The corpus case `not 1 0 1b` is `1b`, and the 2026-09-27 oracle treats `1 0 1 1b` as `'type`. Do not change the lexer to make the spaced form a boolean vector.
- `ssr` still replaces non-overlapping copies. #37 did not change it. #47 only makes a wildcard `ss` interruptible.
- `0N=0N` stays `1b`, as the corpus recorded from real q on 2026-09-27. Do not "fix" null equality.
- #40 Workers Builds. Not this run's work. Do not merge it from a night run.
- `0x0 sv` (bytes to an integer). #49 did not change it.
