---
title: Grids of numbers
chapter: Thinking in arrays
blurb: Each-left and each-right build grids, and a grid of numbers is a picture.
---

`x ,/: y` joins `x` with **each item of y** — that's *each-right*. `x ,\: y` joins **each item of x** with `y` — *each-left*:

```q
1 2 3,/:10 20
```

```q
1 2 3*\:1 10 100
```

That second one is a multiplication table: each item of `1 2 3` times the whole of `1 10 100`. A list of equal-length lists is a **matrix**:

```q
m:(til 5)*\:til 5
m
```

## Matrices are pictures

`heatmap` draws a matrix as a picture — one cell per number, coloured from low to high:

```q sketch
heatmap (til 60)*\:til 60
```

Try other formulas of row and column. `sin` of their sum makes waves:

```q sketch
k:til[80]%8
heatmap sin k+\:k
```

The distance from the middle makes a sonar ping:

```q sketch
k:til[100]-50
heatmap sin 0.3*sqrt (k*k)+\:k*k
```

## Every point on a grid

`grid[w;h]` gives every point of a w×h grid as rows `(xs;ys)` — ready to draw:

```q
grid[3;2]
```

```q sketch
g:30+60*grid[10;10]
background 20
ink hsb[(g[0]+g[1])%1200;0.6;1]
circle[g;22]
```

## Your turn

```q challenge
%% goal Draw a heatmap of a 40×40 matrix where the cell at row i, column j is i*j.
background 20
heatmap 40#enlist til 40
%% check arg[`heatmap;0]~(til 40)*\:til 40 | The cell at row i, column j should be i*j.
%% hint (til 40)*\:til 40 multiplies each row number by every column number.
%% solution
background 20
heatmap (til 40)*\:til 40
```
