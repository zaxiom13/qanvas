---
title: Colour
chapter: First light
blurb: Grays, names, red-green-blue — and whole rainbows at once.
---

Every shape takes an optional **last argument: its fill colour**. `circle[position;radius;colour]`. The colour belongs to the shape it's written in — nothing else changes.

Qanvas understands colour written in several shapes:

| you write | you get |
|---|---|
| `128` | a gray from 0 (black) to 255 (white) |
| `` `coral `` | a named colour |
| `255 120 0` | red, green and blue, each 0–255 |
| `255 120 0 100` | …plus opacity, 0–255 |
| `"#3ddc97"` | a hex colour, written as a string |

```q sketch
background 245 240 230
circle[150 300;100;`coral]
circle[300 300;100;0 150 255 160]
circle[450 300;100;"#3ddc97"]
```

## One colour per shape

`hsb[hue;saturation;brightness]` builds colours from a hue (0 to 1 goes once around the rainbow), a saturation and a brightness. It's just a function that returns numbers — try it:

```q
hsb[0.6;0.8;1]
```

Hand it a **list** of hues and you get a list of colours: three rows (reds; greens; blues), one column per shape. Pass that as the fill, and each circle gets its own:

```q sketch
n:24
background 20
circle[(12+25*til n;300);12;hsb[til[n]%n;0.8;1]]
```

`til[n]%n` is `0 0.04 0.08 … 0.96`: 24 hues spread around the colour wheel.

> **Tip:** `til[n]%n` and `(til n)%n` mean the same thing. Square brackets apply a function to exactly what's inside them.

> **Tip:** if lots of shapes share one colour, `` ink `coral `` sets the default fill for everything drawn after it. The last argument always wins.

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
%% check $[3>count drew[`circle;0];0b;0>type c:arg[`circle;2];0b;30<count distinct flip c] | Give each circle its own colour — pass hsb with a list of hues as circle's third argument.
%% hint circle[points;radius;hsb[hues;0.8;1]] gives one colour per hue.
%% solution
background 20
a:6.28*til[36]%36
circle[center+(220*cos a;220*sin a);14;hsb[til[36]%36;0.8;1]]
```
