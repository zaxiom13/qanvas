---
title: The Game of Life
chapter: Pixels
blurb: Conway's classic — a whole grid updated by one small rule, in a few lines of arrays.
---

Imagine a grid of cells, each alive (1) or dead (0). Every tick:

- a live cell with 2 or 3 live neighbours survives,
- a dead cell with exactly 3 live neighbours comes alive,
- everyone else dies, or stays dead.

In most languages that's four nested loops. In q it's a handful of whole-grid operations.

## Shifting a grid

`rotate` shifts a list. On a grid — a list of rows — it shifts the rows up or down:

```q
g:(1 0 0;0 1 0;0 0 1)
1 rotate g
```

To shift sideways, rotate each row with `rotate'`:

```q
1 rotate' g
```

## Counting neighbours

Shift the grid all nine ways (including not at all) and add the results. Every cell ends up holding the sum of itself and its eight neighbours:

```q
g:(0 0 0 0;0 1 1 0;0 1 0 0;0 0 0 0)
v:(-1 0 1) rotate\: g
nb:sum raze {(-1 0 1) {x rotate' y}\: x} each v
nb
```

## The rule

With the total including the cell itself, the rules become: *alive next time if the total is 3, or if it's alive now and the total is 4*.

```q sketch
n:60
world:n cut (n*n)?2
step:{[w]
  v:(-1 0 1) rotate\: w;
  nb:sum raze {(-1 0 1) {x rotate' y}\: x} each v;
  (nb=3) or w and nb=4
 }
fps 12
draw:{
  if[mousedown; world::n cut (n*n)?2];
  world::step world;
  heatmap["f"$world;`ice]
 }
```

Click to reseed. Because `rotate` wraps around, the world is secretly a doughnut: anything leaving one edge reappears on the other.

## Your turn

```q challenge
%% goal Start with an empty 20×20 world and place a glider: row;column 0 1, 1 2, 2 0, 2 1 and 2 2.
world:20 cut 400#0
step:{[w] v:(-1 0 1) rotate\: w; nb:sum raze {(-1 0 1) {x rotate' y}\: x} each v; (nb=3) or w and nb=4}
fps 8
draw:{world::step world; heatmap["f"$world;`ice]}
%% check 5=sum sum world | A glider has exactly 5 live cells — and keeps them as it glides.
%% hint world[0;1]:1 sets the cell in row 0, column 1.
%% hint world[2;0 1 2]:1 sets three cells of row 2 at once.
%% solution
world:20 cut 400#0
world[0;1]:1
world[1;2]:1
world[2;0 1 2]:1
step:{[w] v:(-1 0 1) rotate\: w; nb:sum raze {(-1 0 1) {x rotate' y}\: x} each v; (nb=3) or w and nb=4}
fps 8
draw:{world::step world; heatmap["f"$world;`ice]}
```
