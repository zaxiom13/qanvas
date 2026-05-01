# Examples

Each file here is a single-file Qanvas sketch. A sketch defines two top-level functions:

```q
setup:{ ... }
draw:{[state;frameInfo;input;canvas] ... }
```

Drop the contents of any of these into the Qanvas editor and hit Run. They work on all three backends (browser / local q / cloud q) because the wire protocol is identical.


| File               | What it demonstrates                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `array-heatmap.q`  | Vectorized distance field over point arrays; zero per-cell loops.         |
| `table-bars.q`     | Sketch state is a q table; rendering is a `flip`/projection of columns.   |
| `particles-qsql.q` | qSQL `update` / `delete from where` with `pos` and `v` array columns (position uses `pos` so table ops stay clear next to the `p` variable). |


These examples intentionally emphasize what q does better than JS: array primitives, qSQL, vectorized math, and pair-style position columns (`pos` / `p` / `v`) instead of separate scalar axes where it keeps the sketch clearer.
