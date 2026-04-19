# Examples

Each file here is a single-file Qanvas sketch. A sketch defines two top-level functions:

```q
setup:{ ... }
draw:{[state;frameInfo;input;canvas] ... }
```

Drop the contents of any of these into the Qanvas editor and hit Run. They work on all three backends (browser / local q / cloud q) because the wire protocol is identical.


| File               | What it demonstrates                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `array-heatmap.q`  | Vectorized distance-field + HSV mapping over a grid; zero per-cell loops. |
| `table-bars.q`     | Sketch state is a q table; rendering is a `flip`/projection of columns.   |
| `particles-qsql.q` | qSQL `update` / `delete from where` as the entire physics engine.         |


These examples intentionally emphasize what q does better than JS: array primitives, qSQL, vectorized math.