---
title: Fold it up, scan it out
chapter: Thinking in arrays
blurb: over (/) boils a list down to one value; scan (\) shows every step along the way.
---

`+/` puts a `+` between every item of a list:

```q
+/[1 2 3 4]
```

That's `1+2+3+4`. The `/` is called **over**: it turns a two-argument function into one that folds a whole list down to a single value. `sum` is just a friendly name for `+/`.

> **Heads up:** a function made with an iterator — like `+/` — can't be applied just by writing the argument after it. `+/ 1 2 3` is an error in q! Give it brackets, `+/[x]`, or parentheses, `(+/) x`. Qanvas will remind you if you forget.

```q
(*/) 1 2 3 4 5
```

```q
{x,y}/[(1 2;3;4 5)]
```

Put a starting value on the left and over folds from there — no brackets needed:

```q
100+/1 2 3
```

## Scan keeps every step

Swap `/` for `\` — **scan** — and you get every running total:

```q
+\[1 2 3 4]
```

`sums` is the friendly name for `+\`.

## A random walk

Scan is perfect for a random walk. Take 600 random steps of +1 or -1, and the running total is where you are after each one:

```q sketch
steps:-1+2*600?2
ys:300+10*sums steps
background 250 247 240
pen `indigo; weight 2; ink `none
path (til 600;ys)
```

Every run makes a different wiggle. It's also — famously — a very simple model of a stock price.

> **Heads up:** a space *before* `/` starts a comment, so `x /2` is `x` followed by a comment!

## Repeat, and repeat again

With a one-argument function, `/` repeats it. A number on the left says how many times:

```q
10 {x*2}/ 1
```

…and `\` shows each step:

```q
10 {x*2}\ 1
```

## Wandering in two dimensions

Scan two rows of random steps and you get a path that wanders across the plane. Colour it by time and it glows:

```q sketch
n:3000
p:300+(+\) each (-4+n?8f;-4+n?8f)
background 12 12 22
ink hsb[til[n]%n;0.7;1]
circle[p;1.5]
```

`(+\) each` scans each row separately: the xs and the ys each get their own running totals. (`sums each` does the same.)

## Your turn

```q challenge
%% goal Plot the running total of 50 random values as a line that climbs across the canvas.
v:50?10f
background 250 247 240
pen `coral; weight 3; ink `none
path (12*til 50;590-v)
%% check 50=count first arg[`path;0] | Draw one line through 50 points.
%% check all 0>=1_deltas last arg[`path;0] | Plot the running total, so every point is at least as high as the one before.
%% hint sums v (or +\v) gives the running totals.
%% solution
v:50?10f
background 250 247 240
pen `coral; weight 3; ink `none
path (12*til 50;590-sums v)
```
