---
title: Dictionaries
chapter: Data
blurb: Keys and values — q's way of giving things names.
---

A **dictionary** maps keys to values. Build one with `!` — keys on the left, values on the right:

```q
d:`red`green`blue!255 128 0
d
```

Look values up by key — exactly the way you index a list:

```q
d`green
```

```q
d`red`blue
```

`key` and `value` pull the two halves apart:

```q
key d
```

## A palette

Dictionaries are perfect for naming things. Here's a palette of colours, looked up by name:

```q sketch
pal:`sky`sea`sand`sun!(135 206 235;20 90 160;240 220 170;255 200 60)
background pal`sky
ink pal`sea; rect[0 380;600 220]
ink pal`sand; rect[0 470;600 130]
ink pal`sun; circle[460 130;60]
```

## Maths on dictionaries

Arithmetic works on the values and keeps the keys:

```q
prices:`apple`pear`fig!1.2 0.8 3.5
prices*2
```

Two dictionaries line up **by key**, not by position:

```q
(`a`b!1 2)+`b`c!10 20
```

## Counting things

`count each group` counts how many times each item appears — a dictionary from item to count:

```q
count each group "mississippi"
```

That's a chart waiting to happen:

```q sketch
s:"the quick brown fox jumps over the lazy dog and keeps on running"
c:count each group s except " "
k:asc key c
v:c k
background 250 247 240
ink `indigo
rect[(20+22*til count k;560-40*v);(18;40*v)]
ink 40; font 13; align `center
text[(29+22*til count k;580);string k]
```

## Your turn

```q challenge
%% goal Make a dictionary sizes mapping `small`medium`large to 20 50 90, then draw three circles in a row using those sizes.
sizes:20 50 90
background 20
ink `mint
circle[(120 300 480;300);sizes]
%% check 99=type sizes | sizes should be a dictionary: keys!values.
%% check (`small`medium`large!20 50 90)~sizes | Map `small`medium`large to 20 50 90.
%% check 20 50 90~"j"$arg[`circle;1] | Draw the circles using the sizes — value sizes gives the three numbers.
%% hint `small`medium`large!20 50 90
%% solution
sizes:`small`medium`large!20 50 90
background 20
ink `mint
circle[(120 300 480;300);value sizes]
```
