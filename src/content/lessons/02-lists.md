---
title: One call, many shapes
chapter: First light
blurb: Lists are q's superpower. Hand a function a list and it does the whole list at once.
---

In most languages, drawing ten circles means writing a loop. In q you hand `circle` ten positions — and it draws ten circles. This lesson is about that one idea, because everything else grows from it.

## Lists

A list is just values side by side, separated by spaces:

```q
10 20 30
```

Arithmetic works on the **whole list at once**. No loop:

```q
10 20 30*2
```

```q
1 2 3+10 20 30
```

Two lists of the same length pair up item by item. A single number — an **atom** — pairs up with every item of a list.

## til

`til n` gives the first *n* whole numbers, counting from zero. It's the heartbeat of array code:

```q
til 10
```

Multiply it, and you've got evenly spaced positions:

```q
50*til 10
```

## Many circles

Positions for many shapes are written as **two rows**: the x's and the y's. `(xs;ys)` — round brackets with a semicolon make a list of two things.

```q sketch
xs:30+60*til 10
background 20
ink `sky
circle[(xs;300);25]
```

`xs` holds ten x positions. The y row is just `300` — a single number that every circle shares. One call, ten circles.

> **Tip:** `xs:30+60*til 10` stores the list under the name `xs`. In q, `:` means *assign*. Equality is `=`.

The radius can be a list too, one per circle:

```q sketch
xs:30+60*til 10
background 20
ink `sky
circle[(xs;300);3*1+til 10]
```

## Your turn

```q challenge
%% goal Draw a column of 12 circles running down the canvas — all with the same x.
background 20
ink `mint
circle[300 300;20]
%% check 12=drawn`circle | Draw exactly 12 circles — one call with 12 y positions.
%% check 1=count distinct raze first arg[`circle;0] | The circles should all share one x position.
%% hint Swap the roles from the example: keep x as one number, and build the y's from til 12.
%% hint Try circle[(300;25+50*til 12);20]
%% solution
background 20
ink `mint
circle[(300;25+50*til 12);20]
```
