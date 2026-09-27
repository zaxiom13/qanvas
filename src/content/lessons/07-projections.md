---
title: Half a function
chapter: Functions
blurb: Fill in some arguments now and the rest later. q calls these projections.
---

Give a two-argument function just its first argument, and you get back a function waiting for the second one:

```q
add:{x+y}
add5:add[5]
add5 10
```

`add[5]` is called a **projection** — the function `add`, with `x` fixed to 5. You can leave *any* argument empty with nothing between the semicolons:

```q
minus:{x-y}
from100:minus[100;]
less100:minus[;100]
(from100 30;less100 130)
```

## Projections of drawing functions

Built-in functions project too. `circle[;8]` is "a circle of radius 8, position to be decided":

```q sketch
dot:circle[;8]
background 20
ink `mint
dot (40+60*til 10;300)
ink `coral
dot (300;40+60*til 10)
```

A whole family of tools, one line each:

```q sketch
big:circle[;120]
small:circle[;20]
background 30
ink `indigo; big center
ink `lemon; small center
```

## Operators are functions too

`+` is a function of two arguments. Wrap it in brackets and you can project it just like `add`:

```q
twice:*[2]
twice 1 2 3
```

## Your turn

```q challenge
%% goal Make a projection of rect called tile that always draws 40-pixel squares. Then use it to draw a row of 10 squares.
tile:rect
background 20
ink `sky
tile[(55*til 10;280);40]
%% check 104=type tile | tile should be a projection: rect with the size filled in, like rect[;40].
%% check 10=drawn`rect | Draw 10 squares with tile.
%% hint A projection leaves one argument empty: rect[;40].
%% hint Then call it with just the positions: tile (55*til 10;280)
%% solution
tile:rect[;40]
background 20
ink `sky
tile (5+60*til 10;280)
```
