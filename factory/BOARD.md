# Qanvas board

Reconciled 2026-10-16 (Europe/London). `main` is `e4dcfbb` (merge of #53). Five improvement drafts from this run are open. #41, #42, #44 and the drafts #55–#59 and #61–#65 were not edited. Nothing here is a commitment until a card says shipped and the PR is merged.

[#66](https://github.com/zaxiom13/qanvas/pull/66) is the 2026-10-15 board. [#60](https://github.com/zaxiom13/qanvas/pull/60) is the 2026-10-14 board. [#54](https://github.com/zaxiom13/qanvas/pull/54) is the 2026-10-13 board. Do not merge any of them on top of this file. This PR carries `factory/journal/2026-10-11.md`, `factory/journal/2026-10-13.md`, `factory/journal/2026-10-14.md` and `factory/journal/2026-10-15.md`, which otherwise exist only on those drafts.

## This run

| PR | State | What a learner gets |
| --- | --- | --- |
| [#67](https://github.com/zaxiom13/qanvas/pull/67) | Open draft | `each` of a builtin on a long list stops when the run budget is spent |
| [#68](https://github.com/zaxiom13/qanvas/pull/68) | Open draft | A long `bin` search stops when the run budget is spent |
| [#69](https://github.com/zaxiom13/qanvas/pull/69) | Open draft | An error with no specific hint still shows a plain-English sentence |
| [#70](https://github.com/zaxiom13/qanvas/pull/70) | Open draft | Inside `circle[ ... ]`, the signature shows and the current argument is marked |
| [#71](https://github.com/zaxiom13/qanvas/pull/71) | Open draft | Turning the phone does not restart the running sketch |

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
| [#61](https://github.com/zaxiom13/qanvas/pull/61) | Open draft | A long `sums`, `avgs`, `group`, `distinct` or sort stops when the run budget is spent |
| [#62](https://github.com/zaxiom13/qanvas/pull/62) | Open draft | `.Q.fmt` wider than 8,000,000 characters is `'limit`. A negative width is `'domain` |
| [#63](https://github.com/zaxiom13/qanvas/pull/63) | Open draft | Duplicating a copy is named "Copy 2 of …", not "Copy of Copy of …" |
| [#64](https://github.com/zaxiom13/qanvas/pull/64) | Open draft | A failed check says "Not yet". A solved problem says "solved" |
| [#65](https://github.com/zaxiom13/qanvas/pull/65) | Open draft | Muted text and the pass, fail and warning colours clear 4.5:1 |

#41's GitHub check passed. Its Cloudflare Workers Builds check is still failed, from 2026-10-11. Not edited. Not investigated with a Cloudflare account.

`git merge-tree --write-tree` of #68 with #44 and with #61 exits 0. #71 with #42, #56 and #59 exits 0. They were not re-tested as a combined tree. #67 edits `interp.ts` only. #69 edits the error card, `explain.ts` and `errors.ts`. #70 edits the editor only.

#40 (Workers Builds) is merged. A push to `main` still deploys. Do not merge from a night run.

## Roadmap

1. **Installability — shipped (#28), unchanged.** Real PNGs from `tools/make-icons.mjs`. Not done: a real Android install, an iOS home-screen check, Lighthouse.
2. **Offline — not retested tonight.** Precache on `main` at `e4dcfbb` is 22 entries, 2504.46 KiB. Not done: an `autoUpdate` swap mid-session over an unsaved edit.
3. **Saved work — #41 and #42 still open.** Not done: a progress schema version, or backup of lesson and Dojo progress.
4. **Portrait and landscape — #53 is on `main`. #71, open, keeps one stage and one editor across the turn.** #56 is still open for the keyboard. A physical keyboard and a notch were not tested. A wide desktop window still starts the sketch again.
5. **Main-thread responsiveness — #67 and #68, open, check the deadline inside `each` of a builtin and inside `bin`.** #61, #62 and #55 are still open and were not edited. A Worker is still only a proposal.
6. **Bundle — measured, not split.** One JS chunk on `main`: 2,161.66 kB (gzip 669.14 kB). The largest branch tonight is #70 at 2,163.81 kB (gzip 669.91 kB). No code splitting.
7. **Android wrapper — parked.** Not confirmed. PWA installability is the committed goal. Do not start a TWA/WebView shell until Zak confirms or the PWA milestones above are done.

## Feature cards

### F6 Editor UX — in progress

- Hover docs that use the reference catalog are already on `main`. There was no earlier PR for this card.
- **This run:** increment 1, [#70](https://github.com/zaxiom13/qanvas/pull/70), open. While the caret is inside `circle[300 300;100]`, the tooltip says `circle[p;r]` and bolds `r`. A nested call hints the inner name. A name that is not in the reference shows nothing.
- **Evidence:** `test/signature.test.ts`. Headless Chrome, light theme, live re-run off, phone 390×844 and desktop 1280×800. The bold argument read back as `r`.
- **Rough edges:** a glyph call such as `+[1;2]` is not hinted. A call split across a newline is treated as ended. A selected range hides the hint.
- **Next iterations:**
  1. An in-app shortcuts sheet. The guide already lists Ctrl/⌘+Enter, Ctrl/⌘+/ and Ctrl/⌘+`.
  2. The same hint for a glyph call.
  3. Keep the hint above the symbol bar when the phone keyboard is open. #56 is the unmerged keyboard inset.

### F1 Sketch library management — in progress, no new increment this run

- **Shipped:** [#38](https://github.com/zaxiom13/qanvas/pull/38) export and import. [#43](https://github.com/zaxiom13/qanvas/pull/43) Duplicate. [#45](https://github.com/zaxiom13/qanvas/pull/45) a second import of the same id, name and code is skipped.
- **Open:** [#57](https://github.com/zaxiom13/qanvas/pull/57) filter by name. [#63](https://github.com/zaxiom13/qanvas/pull/63) "Copy 2 of …" instead of stacking "Copy of".
- **Not this run.** A filtered count would edit the gallery #57 already edits. Numbering copies from the whole library would edit the gallery too. A progress backup waits on #41.
- **Next iterations:** the next free "Copy N" by looking at names already saved, after #63 has merged; the filtered count, after #57 has merged; lesson and Dojo progress in a backup, after #41 has merged.

### F3 Dojo expansion — in progress, no new increment this run

- **Open:** [#58](https://github.com/zaxiom13/qanvas/pull/58). Four dictionary problems. A qSQL set would stack on that unmerged increment.
- **Next iterations:** qSQL, then temporals, then strings and symbols. A few problems at a time.

### F7 Share polish — in progress, no new increment this run

- **Shipped:** [#31](https://github.com/zaxiom13/qanvas/pull/31) reuses an unedited copy. [#36](https://github.com/zaxiom13/qanvas/pull/36) warns past 8,000 characters. [#50](https://github.com/zaxiom13/qanvas/pull/50) shows the name and a thumbnail.
- **Next iterations:** a local QR code, revisit 8,000 if a chat app is measured, remember a dismissed arrival bar. A QR button would edit `StudioView.svelte`, which #42, #59 and now #71 also edit. Left until one of those has merged.

### Kept, not started this run

F4 resume cell and reset lesson. Must not wipe `done` or saved answers. #41 is the unmerged progress write path. Learn view is also edited by the unmerged #64.

### Parked again (keep parked)

These were parked on 2026-10-14 and kept parked on 2026-10-15. No new evidence tonight, so they stay parked. This is the keep decision for a third run.

- **F2 Animated export.** The JS chunk is 2.16 MB. Park until a lazy encoder is measured against the precache.
- **F5 Reference backlinks.** "Try in the console" already exists. Park while F1, F3 and F6 have open next iterations.
- **F8 Onboarding tour.** Park. A tour caused z-index and keyboard bugs in v1.
- **F9 New lessons.** Park until the Dojo sets for the existing chapters exist. #58 is still open.
- **R2 Micro-interactions.** Park. `prefers-reduced-motion` is already global. No timing bug was reproduced.

### R1 Error copy — partial

[#69](https://github.com/zaxiom13/qanvas/pull/69), open. A compact card with no specific hint now shows the general sentence. `'type` from `10 vs 1 2` is the case that was shot. `params`, `return`, `s-fail`, `u-fail` and `internal` now have a sentence. A `'stop` with no hint says "Stopped." A budget stop keeps its own sentence.

**Next iterations:** a specific hint on the bare `typeErr()` throws, so the sentence can name the argument. A wording pass on the budget `'stop` line. Not done tonight.

### R3 Visual consistency — partial, no new increment this run

[#65](https://github.com/zaxiom13/qanvas/pull/65), still open. Syntax comments and the light type-number and type-float chips were left under 4.5:1 on purpose there. Not stacked.

### R4 Empty and edge states — partial

A failed share decode toasts (#31, merged). #42, open, covers a route id pointing at a deleted sketch. Still open: a screen for no saved lesson progress.

### R5 Copy — not started

README still says "number scrubbing", which `1b8e47e` removed. #58, open, is the draft that changes the Dojo count from 33 to 37 and also edits that README. `tools/` still has scratch files (`t.ts`, `t2.ts`, `t3.ts`, `probe1.txt`, `q2.txt`, `typetable.txt`). Not deleted. Usage not confirmed. The two `state_referenced_locally` warnings are unchanged. No AGENTS.md.

## Accessibility

[#64](https://github.com/zaxiom13/qanvas/pull/64) and [#59](https://github.com/zaxiom13/qanvas/pull/59) and [#65](https://github.com/zaxiom13/qanvas/pull/65) are still open and were not edited. [#69](https://github.com/zaxiom13/qanvas/pull/69) puts a sentence on an error that had only a name. Not done: a screen reader on a device, a text alternative for the drawing beyond "Sketch canvas".

## Draw

Seed `20261016`. One draw:

```python
random.Random(20261016).choices(
    ["features", "refinement", "q parity", "mobile", "content", "performance", "accessibility", "docs"],
    weights=[20, 15, 20, 12, 10, 10, 8, 5],
    k=1,
)
```

Result: **features**. That slot is #70, F6 signature hints. The same call returns mobile for `20261009`, q parity for `20261010`, q parity for `20261011`, q parity for `20261012`, mobile for `20261013`, content for `20261014`, and accessibility for `20261015`, which matches those journals.

Slots this run: reliability (#67 `each`), reliability (#68 `bin`), feature F6 (#70), refinement R1 (#69), reliability layout (#71, the turn restarted the sketch and that was reproduced). No feature slot was displaced.

## Parked on purpose

- v1 branches (`cursor/*` from before the 2026-09-27 rewrite, closed PRs #10, #16, #18, #20–#23). No merge base with `main`. Not rebased, not revived.
- Android shell. See roadmap 7.
- Interpreter Worker. The caps and the deadline checks stay inside the primitives. A Worker stays a proposal.
- Spaced boolean vectors such as `where 0 1 1 0 1b`. Do not change the lexer.
- `ssr` still replaces non-overlapping copies.
- `0N=0N` stays `1b`. Do not "fix" null equality.
- `0x0 sv`. Not changed.
- #54, #60 and #66. Superseded by this board. Do not merge them.
