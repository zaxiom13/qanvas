---
title: Your own functions
chapter: Functions
blurb: Wrap an idea in curly braces and give it a name.
---

A **function** in q is code wrapped in curly braces. Inside it, `x` means "whatever you were given":

```q
{x*x} 5
```

Give it a name and use it like any built-in:

```q
sq:{x*x}
sq 1 2 3 4
```

Because `x*x` works on whole lists, so does `sq`. You wrote it thinking about one number and got lists for free. That happens *all the time* in q.

## Two or three arguments

Use `x` and `y` (and `z`) for more arguments, and call with square brackets:

```q
hyp:{sqrt (x*x)+y*y}
hyp[3;4]
```

Prefer your own names? Declare them in square brackets at the start:

```q
area:{[w;h] w*h}
area[3;5]
```

And yes — lists still just work:

```q
area[1 2 3;10]
```

## Functions that draw

A function can draw, too. Here's `flower`, which draws petals around any centre:

```q sketch
flower:{[c;r]
  a:6.28*til[8]%8;
  ink `rose; circle[c+(r*cos a;r*sin a);r*0.6];
  ink `lemon; circle[c;r*0.5]
 }
background 245 240 230
flower[150 200;40]
flower[400 350;70]
flower[250 480;25]
```

> **Heads up:** inside `{ }`, a new line does **not** end a statement — put a `;` between them. If you forget, Qanvas will point at the spot.

`a` is a **local** name: it exists only while `flower` runs, then it's gone.

## Your turn

```q challenge
%% goal Write a function ring[c;r] that draws 12 small circles evenly around a circle of radius r at centre c. Then draw at least three rings.
ring:{[c;r]
  circle[c;r]
 }
background 20
ring[center;100]
%% check 100=type ring | Define ring as a function.
%% check 36<=drawn`circle | Draw at least 3 rings of 12 circles — that's 36 circles or more.
%% hint Inside ring, make 12 angles: a:6.28*til[12]%12 — then draw circle[c+(r*cos a;r*sin a);8].
%% hint Don't forget the ; at the end of the line that sets a.
%% solution
ring:{[c;r]
  a:6.28*til[12]%12;
  circle[c+(r*cos a;r*sin a);8]
 }
background 20
ink `sky
ring[center;60]
ring[center;130]
ring[center;200]
```
