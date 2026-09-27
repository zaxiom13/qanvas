---
title: Deciding, all at once
chapter: Functions
blurb: Booleans, $[if;then;else], and the array trick of choosing for every item in one go.
---

## True and false

Comparisons give **booleans**: `1b` for true and `0b` for false.

```q
3>2
```

Compare a list and you get a list of booleans — one per item:

```q
x:4 9 1 7 3
x>5
```

## One decision: $[ ]

`$[condition;then;else]` picks one of two values:

```q
{$[x>5;`big;`small]} 7
```

Add more pairs for "else if":

```q
grade:{$[x>=90;`A;x>=70;`B;`C]}
grade 95
```

That's great for one value — but what about a whole list?

## Many decisions: ?[ ]

`?[booleans;a;b]` chooses **item by item**: from `a` where the boolean is true, from `b` where it's false.

```q
x:4 9 1 7 3
?[x>5;100;0]
```

No loops, no `if`. This is how you decide things in array land. Let's use it to size circles by which half of the canvas they're in:

```q sketch
xs:30+60*til 10
r:?[xs<300;10;28]
background 20
ink `sky
circle[(xs;300);r]
```

> **Why:** a loop with an `if` inside asks one question at a time. `?[ ]` asks every question at once — and q is built to be fast at exactly that.

## Your turn

```q challenge
%% goal Draw 20 circles in a row. Circles on the left half should have radius 8; circles on the right half, radius 20.
xs:15+30*til 20
background 20
ink `coral
circle[(xs;300);8]
%% check 20=drawn`circle | Draw 20 circles.
%% check (20#8 20 where 10 10)~"j"$arg[`circle;1] | Radius 8 on the left half (x below 300) and 20 on the right.
%% hint Build the radii with ?[xs<300;8;20].
%% solution
xs:15+30*til 20
background 20
ink `coral
circle[(xs;300);?[xs<300;8;20]]
```
