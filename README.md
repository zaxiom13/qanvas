# Qanvas — learn q by drawing

A creative-coding studio for the **q** language (the language of kdb+), running entirely in your browser — offline too.

- **A q interpreter in TypeScript**, checked against a real KDB-X install: tables, qSQL, dictionaries, iterators, temporals, q-style console output and errors (with plain-English explanations and an *explain* stepper that shows q reading right to left).
- **Array-first drawing on p5.js.** A point is `x y`; many points are rows `(xs;ys)`. `circle[(xs;ys);r;hsb[hues;0.7;1]]` draws a thousand coloured circles in one call.
- **Learn:** 30 lessons in 9 chapters — from `til 10` to flow fields, the Game of Life, the Mandelbrot set, a neural network you can watch think, and a ray tracer. Every lesson ends in a checked challenge.
- **Sketch:** studio with live re-run, number scrubbing, examples gallery, local saving and share links.
- **Dojo:** 33 practice problems with instant checks. **Reference:** every primitive and function with live examples.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # ~1300 tests: q parity, examples, lessons, dojo, reference
npm run build      # static site in dist/
```

`tools/oracle.mjs` runs expressions through a real q (KDB-X in WSL) so `tools/diff.ts` can compare outputs.

*kdb+ and q are trademarks of KX Systems. Qanvas is an independent learning project, not affiliated with or endorsed by KX.*
