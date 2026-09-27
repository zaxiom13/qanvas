---
title: Filters
chapter: Thinking in arrays
blurb: Booleans pick things out of lists, and where turns them into positions.
---

A comparison gives a list of booleans — one per item. `where` turns that into the **positions** of the trues:

```q
x:30 5 80 12 65
x>20
```

```q
where x>20
```

Index a list with positions and you pick those items out:

```q
x where x>20
```

Read it right to left: *which are bigger than 20 → where are they → take those from x*. The little phrase `x where condition` is one of the most useful things in all of q.

## Filtering points

Points work the same way — pick the same positions from both rows. `p[;i]` means "every row, at positions `i`":

```q
p:(10 20 30 40;1 2 3 4)
p[;1 3]
```

Let's light up just the stars near the mouse:

```q sketch
n:2000
p:(n?600f;n?600f)
draw:{
  background 10 10 25;
  ink 70 70 110;
  circle[p;1.5];
  near:where 100>dist[p;mouse];
  ink `lemon;
  circle[p[;near];3]
 }
```

`dist[p;mouse]` is 2000 distances. `100>…` is 2000 booleans. `where` gives the positions of the close ones, and `p[;near]` picks those points. Four array operations, and not a loop in sight.

## Counting with booleans

A boolean is really a tiny number — `1b` counts as 1 — so `sum` of a boolean list counts the trues:

```q
sum 30 5 80 12 65>20
```

## Your turn

```q challenge
%% goal Scatter 1000 dots. Draw the ones in the right half gray and the ones in the left half coral — every dot exactly once.
n:1000
p:(n?600f;n?600f)
background 20
ink 90
circle[p;3]
%% check 1000=drawn`circle | Draw each of the 1000 dots exactly once — the right half, then the left half.
%% check all 300>first arg[`circle;0] | Finish with the coral dots on the left: every x below 300.
%% hint left:where 300>p 0 gives the positions of the dots on the left.
%% hint Draw p[;right] in gray first, then p[;left] in coral.
%% solution
n:1000
p:(n?600f;n?600f)
left:where 300>p 0
right:where 300<=p 0
background 20
ink 90; circle[p[;right];3]
ink `coral; circle[p[;left];3]
```
