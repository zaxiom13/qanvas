# Qanvas board

Reconciled 2026-10-10 (Europe/London) after the night run. `main` is `bd28099` (merge of #33). The five improvement PRs below are open. Nothing here is a commitment until a card says shipped and the PR is merged.

## This run

| PR | State | What a learner gets |
| --- | --- | --- |
| [#34](https://github.com/zaxiom13/qanvas/pull/34) | Open | `til`, `#` and `?` that would build more than 8,000,000 items stop with `'limit` instead of freezing the tab |
| [#35](https://github.com/zaxiom13/qanvas/pull/35) | Open | Hiding the page pauses a running sketch, and showing it resumes only that pause |
| [#36](https://github.com/zaxiom13/qanvas/pull/36) | Open | A share link longer than 8,000 characters asks before it is copied |
| [#37](https://github.com/zaxiom13/qanvas/pull/37) | Open | `ss` reports overlapping matches |
| [#38](https://github.com/zaxiom13/qanvas/pull/38) | Open | My sketches can be exported to a JSON file and imported back without replacing what is already saved |

Already on `main` from 2026-10-09: [#28](https://github.com/zaxiom13/qanvas/pull/28) icons, [#29](https://github.com/zaxiom13/qanvas/pull/29) save flush, [#30](https://github.com/zaxiom13/qanvas/pull/30) landscape insets, [#31](https://github.com/zaxiom13/qanvas/pull/31) share-copy dedupe, [#32](https://github.com/zaxiom13/qanvas/pull/32) malformed hash, [#33](https://github.com/zaxiom13/qanvas/pull/33) that night's board. This run did not merge, push to `main`, or deploy.

#35 and #36 both edit `StudioView.svelte`. A merge-tree of those two branches produced no conflict markers. They are still separate PRs.

## Roadmap

1. **Installability — shipped (#28), unchanged this run.** Real PNGs from `tools/make-icons.mjs`. Not done: a real Android install, an iOS home-screen check, Lighthouse.
2. **Offline — spot-checked on 2026-10-09, not retested this run.** Precache on `main` at `bd28099` is still 21 entries, 2492.26 KiB (hashed JS, CSS, woff2). The 512 px icons stay out of the precache. Not done: an `autoUpdate` swap mid-session over an unsaved edit.
3. **Saved work — increment on `main` (#29), backup open (#38).** Flush on switch, hide and `pagehide` is merged. #38 adds a version-1 JSON export/import of sketches (new ids, so nothing stored is overwritten; cap 500). Not done: progress schema version, two-tab `markDone` / `saveAnswer` lost updates. `idb-keyval`'s `update()` is the intended fix and was not started.
4. **Portrait and landscape — increment shipped (#30), unchanged this run.** Not done: landscape with the soft keyboard open, a physical notch.
5. **Main-thread responsiveness — increment open (#34).** Lists over 8,000,000 items are refused before allocation (`'limit`). Fills under that cap check the existing deadline every 65,536 items. A Worker is still only a proposal.
6. **Bundle — measured, not split.** One JS chunk on `main`: 2,151.48 kB (gzip 664.61 kB). The largest branch this run is #38 at 2,154.73 kB (gzip 665.73 kB). No code splitting.
7. **Android wrapper — parked.** Not confirmed. PWA installability is the committed goal. Do not start a TWA/WebView shell until Zak confirms or the PWA milestones above are done.

## Feature cards

### F7 Share polish — in progress

- **Shipped:** increment 1, [#31](https://github.com/zaxiom13/qanvas/pull/31), merged. Opening `#/s/…` reuses an unedited copy. A damaged link toasts and falls back to `#/sketch`.
- **This run:** increment 2, [#36](https://github.com/zaxiom13/qanvas/pull/36), open. URLs longer than 8,000 characters ask before copy. Every built-in example is under that line (longest is `neuron` at 1,370). An 800-line sketch was 10,745 characters and warned. Cancel is focused so Enter does not copy.
- **Evidence:** `test/share.test.ts` (9 tests on that branch). Phone 390×844 and desktop 1280×800, light theme, live re-run off.
- **Rough edges:** 8,000 is a local guess between Discord's 2,000 and Chrome's ~2,000,000. Not measured on WhatsApp, iMessage, Slack, or a phone. Copy anyway still copies a fragile URL.
- **Next iterations:**
  1. Share preview on open: name plus a locally rendered thumbnail.
  2. A QR code for phone hand-off, generated locally, no remote service.
  3. Revisit 8,000 if a real chat-app measurement says the line is wrong.

### F1 Sketch library management — in progress

- **This run:** increment 1, [#38](https://github.com/zaxiom13/qanvas/pull/38), open. Export downloads `qanvas-sketches.json` (`kind: "qanvas-sketches"`, `version: 1`). Import adds sketches. An id already on the device is reminted. Version other than 1 is refused. Bad entries are skipped. At most 500 sketches are added from one file.
- **Evidence:** `test/backup.test.ts`, 5 tests. Headless Chrome, phone 390×844 and desktop 1280×800: import showed "Imported 1 sketch." beside the existing Untitled sketch, and Export downloaded `qanvas-sketches.json`.
- **Rough edges:** importing the same file twice adds another copy. No match on code. Thumbnails in the shots were still the placeholder. Lesson and Dojo progress are not in the file.
- **Next iterations:**
  1. Duplicate one of your own sketches.
  2. Filter My sketches by name.
  3. A second import of the same backup should not pile up another copy.

### Not started

| Card | Why it waited |
| --- | --- |
| F2 Animated export | Bundle cost unknown; encoder must be lazy and precached. |
| F3 Dojo: dictionaries, qSQL, temporals, strings | Needs real-q or cited semantics per problem. |
| F4 Learn progress: chapter badges, resume cell, reset lesson | Must not wipe `done` / saved answers. |
| F5 Reference: open in Sketch, lesson/Dojo backlinks | |
| F6 Editor: hover docs, signature hints, shortcuts sheet | |
| F8 Onboarding | Keep it to a dismissible empty state. No tour (v1 z-index bugs). |
| F9 New examples and lessons | Each must pass the existing content suites. |

## Refinement cards

### R4 Empty and edge states — partial, inside #31

A failed share decode toasts. Still open: empty gallery (already has copy), no saved progress, `lastSketch` pointing at a deleted sketch.

### Not started

R1 error and stop copy. R2 micro-interactions (`prefers-reduced-motion` is already global). R3 visual consistency, both themes. R5 terminology sweep. README still says "number scrubbing", which `1b8e47e` removed. `tools/` still has scratch files (`t.ts`, `t2.ts`, `t3.ts`, `probe1.txt`, `q2.txt`, `typetable.txt`); not deleted, usage not confirmed. The two `state_referenced_locally` warnings in `LessonCell.svelte` and `ChallengeCell.svelte` are unchanged. No AGENTS.md.

## Draw

Seed `20261010`, `random.Random(20261010).choices` over the brief's weights, one draw: **q parity**. That slot is #37. Feature slots are F7 increment 2 (#36) and F1 increment 1 (#38). The other two slots are reliability (#34, #35). No feature slot was displaced.

## Parked on purpose

- v1 branches (`cursor/*` from before the 2026-09-27 rewrite, closed PRs #10, #16, #18, #20–#23). No merge base with `main`. Not rebased, not revived.
- Android shell. See roadmap 7.
- Interpreter Worker. #34 is the guard. A Worker stays a proposal.
- Spaced boolean vectors such as `where 0 1 1 0 1b`. The corpus case `not 1 0 1b` is `1b`, and the 2026-09-27 oracle treats `1 0 1 1b` as `'type`. Do not change the lexer to make the spaced form a boolean vector.
- `ssr` still replaces non-overlapping copies. #37 did not change it.
