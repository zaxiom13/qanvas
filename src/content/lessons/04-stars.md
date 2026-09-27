---
title: Scatter the stars
chapter: First light
blurb: Random numbers, rows of points, and your first night sky.
---

## Random numbers

`n?m` asks q for *n* random numbers below *m*:

```q
5?10
```

Ask for floats (numbers with decimals) by giving a float limit. `1f` means "1, as a float":

```q
3?1f
```

## A cloud of points

Many points are written as two rows, `(xs;ys)`. So 200 random points on our 600×600 canvas are:

```q
p:(200?600f;200?600f)
count each p
```

`count each p` counts each row separately: 200 x's and 200 y's.

```q sketch
p:(200?600f;200?600f)
background 10 12 30
ink 255 255 230
circle[p;2]
```

A starry sky, in one call. Let's vary their sizes:

```q sketch
n:300
p:(n?600f;n?600f)
background 10 12 30
ink 255 255 230
circle[p;0.5+n?2.5]
```

> **Why rows?** A q table stores each column as one list — all the x's together, all the y's together. Drawing works the same way, which means maths on points is maths on whole rows at once.

## Moving points

Add a pair to rows of points and *every* point moves: the x row gets the first number and the y row gets the second.

```q
p:(1 2 3f;10 20 30f)
p+100 0
```

## Your turn

```q challenge
%% goal Draw exactly 500 stars, all in the bottom half of the canvas (y between 300 and 600).
n:500
background 5 5 20
ink 255
circle[(n?600f;n?600f);1.5]
%% check 500=drawn`circle | Draw 500 stars.
%% check all 300<=last arg[`circle;0] | Every star's y should be at least 300.
%% hint The y's are the second row. You want 300 plus a random number up to 300.
%% solution
n:500
background 5 5 20
ink 255
circle[(n?600f;300+n?300f);1.5]
```
