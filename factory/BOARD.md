# Qanvas board

Reconciled 2026-10-11 (Europe/London) after the night run. `main` is `d06e761` (merge of #39). The five improvement PRs below are open drafts. Nothing here is a commitment until a card says shipped and the PR is merged.

## This run

| PR | State | What a learner gets |
| --- | --- | --- |
| [#41](https://github.com/zaxiom13/qanvas/pull/41) | Open draft | Lesson and Dojo progress saved in two tabs at once is kept. One tab no longer wipes the other's done bit or saved answer |
| [#42](https://github.com/zaxiom13/qanvas/pull/42) | Open draft | Deleting the sketch you have open, or reloading a deleted id, opens a sketch that still exists instead of a blank canvas on a dead hash |
| [#43](https://github.com/zaxiom13/qanvas/pull/43) | Open draft | My sketches has Duplicate. The copy is a new sketch and does not keep the share key |
| [#44](https://github.com/zaxiom13/qanvas/pull/44) | Open draft | `` ` vs `` splits lines, symbols and file handles. `0b vs` is the bit pattern. A base below 2 raises `'domain` instead of hanging |
| [#45](https://github.com/zaxiom13/qanvas/pull/45) | Open draft | Importing the same sketch backup again does not add another copy when the id, name and code already match |

Already on `main`: 2026-10-09 [#28](https://github.com/zaxiom13/qanvas/pull/28) icons, [#29](https://github.com/zaxiom13/qanvas/pull/29) save flush, [#30](https://github.com/zaxiom13/qanvas/pull/30) landscape insets, [#31](https://github.com/zaxiom13/qanvas/pull/31) share-copy dedupe, [#32](https://github.com/zaxiom13/qanvas/pull/32) malformed hash, [#33](https://github.com/zaxiom13/qanvas/pull/33) that night's board. 2026-10-10 [#34](https://github.com/zaxiom13/qanvas/pull/34) huge-vector `'limit`, [#35](https://github.com/zaxiom13/qanvas/pull/35) pause when hidden, [#36](https://github.com/zaxiom13/qanvas/pull/36) share-length warning, [#37](https://github.com/zaxiom13/qanvas/pull/37) overlapping `ss`, [#38](https://github.com/zaxiom13/qanvas/pull/38) sketch JSON backup, [#39](https://github.com/zaxiom13/qanvas/pull/39) that night's board. The board text that landed in #39 still listed #34–#38 as open. They are merged. This run did not merge, push to `main`, or deploy.

[#40](https://github.com/zaxiom13/qanvas/pull/40) is an open draft by the same GitHub user, on `cursor/workers-builds-setup-4c9a`. It switches deploy from GitHub Actions wrangler to Cloudflare Workers Builds. This run did not edit, review, or merge it. Merging it is a deploy-path change and stays a human decision. It edits `package.json`. #41 also edits `package.json` (devDependency `fake-indexeddb` only). Those two hunks will need a look if both merge. #41 does not touch `wrangler.jsonc`, the workflows, or `vite.config.ts`.

#42, #43 and #45 all edit `Gallery.svelte`, in different functions (`remove`, the Duplicate button, `onFile`). A merge of more than one of them may need a trivial combine. They were branched separately from `d06e761`.

## Roadmap

1. **Installability — shipped (#28), unchanged this run.** Real PNGs from `tools/make-icons.mjs`. Not done: a real Android install, an iOS home-screen check, Lighthouse.
2. **Offline — spot-checked on 2026-10-09, not retested this run.** Precache on `main` at `d06e761` is 21 entries, 2498.17 KiB (hashed JS, CSS, woff2). The 512 px icons stay out of the precache. Not done: an `autoUpdate` swap mid-session over an unsaved edit.
3. **Saved work — increments open (#41, #42, #45) on top of #29 and #38.** Flush on switch, hide and `pagehide` is merged. Sketch JSON backup is merged. #41 makes `markDone` / `saveAnswer` one IndexedDB `update()`. #42 clears `qanvas:lastSketch` and the pending stash when that sketch is deleted, and opens a remaining sketch instead of resurrecting the deleted one. #45 skips a reimport when the stored id still has the same name and code. Not done: a progress schema version, or backup of lesson and Dojo progress.
4. **Portrait and landscape — increment shipped (#30), unchanged this run.** Gallery shots this run are phone portrait 390×844 and desktop 1280×800. Not done: landscape with the soft keyboard open, a physical notch.
5. **Main-thread responsiveness — #34 merged; #44 stops one more hang.** Lists over 8,000,000 items are refused before allocation (`'limit`). `0b vs` and any integer base below 2 used to spin without reaching a deadline. #44 raises `'domain` for a base below 2 and handles `0b vs` as bits. A Worker is still only a proposal.
6. **Bundle — measured, not split.** One JS chunk on `main`: 2,156.61 kB (gzip 666.49 kB). The largest branch this run is #42 at 2,158.16 kB (gzip 666.95 kB). No code splitting.
7. **Android wrapper — parked.** Not confirmed. PWA installability is the committed goal. Do not start a TWA/WebView shell until Zak confirms or the PWA milestones above are done.

## Feature cards

### F1 Sketch library management — in progress

- **Shipped:** increment 1, [#38](https://github.com/zaxiom13/qanvas/pull/38), merged. Export downloads `qanvas-sketches.json`. Import adds sketches, remints a taken id, refuses a version other than 1, skips bad entries, and adds at most 500.
- **This run:** increment 2, [#43](https://github.com/zaxiom13/qanvas/pull/43), open. Duplicate writes `Copy of ${name}` (trimmed to 200 characters), a new id, the same code, thumb and example id. It does not copy `share`, so reopening the original `#/s/` link still finds the pristine shared copy.
- **This run:** increment 3, [#45](https://github.com/zaxiom13/qanvas/pull/45), open. A second import of the same id with the same trimmed name and code is skipped. The gallery says "Already on this device." A different id with the same name and code is still added. The same id with different code is still copied, not overwritten.
- **Evidence:** `test/sketchCopy.test.ts` on #43. `test/backup.test.ts` on #45 (10 tests on that branch). Headless Chrome, light theme, phone 390×844 and desktop 1280×800. Before #45, one Rings sketch became two and the note was "Imported 1 sketch." After, the count stayed 1 and the note was "Already on this device."
- **Rough edges:** Duplicate stacks the prefix (`Copy of Copy of …`). Import identity ignores thumbnail-only changes. If a different sketch already owns the backup's id, each import still mints another copy. Lesson and Dojo progress are not in the file. #43 and #45 are both unmerged, so neither is on `main` yet.
- **Next iterations:**
  1. Filter My sketches by name.
  2. Number copies so the name does not become `Copy of Copy of …`.
  3. Include lesson and Dojo progress in a backup, additively, without wiping what is already stored.

### F7 Share polish — in progress

- **Shipped:** increment 1, [#31](https://github.com/zaxiom13/qanvas/pull/31), merged. Opening `#/s/…` reuses an unedited copy. A damaged link toasts and falls back to `#/sketch`.
- **Shipped:** increment 2, [#36](https://github.com/zaxiom13/qanvas/pull/36), merged. URLs longer than 8,000 characters ask before they are copied.
- **This run:** no new increment. #43 leaves `share` off a duplicate so the #31 lookup still works.
- **Rough edges:** 8,000 is a local guess. Not measured on a chat app or a phone. Copy anyway still copies a fragile URL.
- **Next iterations:**
  1. Share preview on open: name plus a locally rendered thumbnail.
  2. A QR code for phone hand-off, generated locally, no remote service.
  3. Revisit 8,000 if a real chat-app measurement says the line is wrong.

### Not started

| Card | Why it waited |
| --- | --- |
| F2 Animated export | Bundle cost unknown; encoder must be lazy and precached. |
| F3 Dojo: dictionaries, qSQL, temporals, strings | Needs real-q or cited semantics per problem. |
| F4 Learn progress: chapter badges, resume cell, reset lesson | Must not wipe `done` / saved answers. #41 only stops two tabs dropping updates. |
| F5 Reference: open in Sketch, lesson/Dojo backlinks | |
| F6 Editor: hover docs, signature hints, shortcuts sheet | |
| F8 Onboarding | Keep it to a dismissible empty state. No tour (v1 z-index bugs). |
| F9 New examples and lessons | Each must pass the existing content suites. |

## Refinement cards

### R4 Empty and edge states — partial

A failed share decode toasts (#31, merged). #42, open, covers `lastSketch` and the route id pointing at a deleted sketch: the pointer is cleared, and the open studio switches to a remaining sketch (or a new untitled one if the library is empty). Still open: an empty gallery beyond the copy already there, and a screen for no saved lesson progress.

### Not started

R1 error and stop copy. R2 micro-interactions (`prefers-reduced-motion` is already global). R3 visual consistency, both themes. R5 terminology sweep. README still says "number scrubbing", which `1b8e47e` removed. `tools/` still has scratch files (`t.ts`, `t2.ts`, `t3.ts`, `probe1.txt`, `q2.txt`, `typetable.txt`); not deleted, usage not confirmed. The two `state_referenced_locally` warnings in `LessonCell.svelte` and `ChallengeCell.svelte` are unchanged. No AGENTS.md.

## Draw

Seed `20261011`. One draw, the same call as the 2026-10-10 journal:

```python
random.Random(20261011).choices(
    ["features", "refinement", "q parity", "mobile", "content", "performance", "accessibility", "docs"],
    weights=[20, 15, 20, 12, 10, 10, 8, 5],
    k=1,
)
```

Result: **q parity**. That slot is #44. Checked against the previous seeds: `20261009` is mobile and `20261010` is q parity, which matches those journals. `random.choice` over a repeated bag is a different call and is not the one used here.

Slots this run: reliability (#41 two-tab progress), reliability (#42 deleted last sketch), feature F1 increment 2 (#43), q parity (#44), feature F1 increment 3 (#45). No feature slot was displaced.

## Parked on purpose

- v1 branches (`cursor/*` from before the 2026-09-27 rewrite, closed PRs #10, #16, #18, #20–#23). No merge base with `main`. Not rebased, not revived.
- Android shell. See roadmap 7.
- Interpreter Worker. #34 is the guard for huge lists. #44 stops the `vs` base loop. A Worker stays a proposal.
- Spaced boolean vectors such as `where 0 1 1 0 1b`. The corpus case `not 1 0 1b` is `1b`, and the 2026-09-27 oracle treats `1 0 1 1b` as `'type`. Do not change the lexer to make the spaced form a boolean vector.
- `ssr` still replaces non-overlapping copies. #37 did not change it.
- `0N=0N` stays `1b`, as the corpus recorded from real q on 2026-09-27. Do not "fix" null equality.
- #40 Workers Builds. Not this run's work. Do not merge it from a night run.
