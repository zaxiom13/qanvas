---
title: Colour
chapter: First light
blurb: Grays, names, red-green-blue — and whole rainbows at once.
---

Qanvas understands colour written in several shapes:

| you write | you get |
|---|---|
| `ink 128` | a gray from 0 (black) to 255 (white) |
| ``ink `coral`` | a named colour |
| `ink 255 120 0` | red, green and blue, each 0–255 |
| `ink 255 120 0 100` | …plus opacity, 0–255 |
| `ink "#3ddc97"` | a hex colour, written as a string |

```q sketch
background 245 240 230
ink `coral; circle[150 300;100]
ink 0 150 255 160; circle[300 300;100]
ink "#3ddc97"; circle[450 300;100]
```

The `;` separates statements written on one line.

## One colour per shape

`hsb[hue;saturation;brightness]` builds colours from a hue (0 to 1 goes once around the rainbow), a saturation and a brightness. Hand it a **list** of hues and you get a list of colours — one per shape:

```q sketch
n:24
background 20
ink hsb[til[n]%n;0.8;1]
circle[(12+25*til n;300);12]
```

`til[n]%n` is `0 0.04 0.08 … 0.96`: 24 hues spread around the colour wheel.

> **Tip:** `til[n]%n` and `(til n)%n` mean the same thing. Square brackets apply a function to exactly what's inside them.

Outlines use `pen`, with `weight` for thickness, and `` `none `` switches fill or outline off:

```q sketch
background 20
ink `none
pen hsb[til[8]%8;0.7;1]
weight 6
circle[center;30+30*til 8]
```

One call, eight rings, eight colours: `circle` got one centre and eight radii.

## Your turn

```q challenge
%% goal Draw 36 circles around a big ring, each a different hue.
background 20
a:6.28*til[36]%36
ink `white
circle[center+(220*cos a;220*sin a);14]
%% check 36=drawn`circle | Draw 36 circles.
%% check $[0>type c:arg[`ink;0];0b;30<count distinct flip c] | Give each circle its own colour — hsb with a list of hues does it.
%% hint ink hsb[hues;1;1] gives one colour per hue.
%% solution
background 20
a:6.28*til[36]%36
ink hsb[til[36]%36;0.8;1]
circle[center+(220*cos a;220*sin a);14]
```
