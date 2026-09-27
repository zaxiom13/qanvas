---
title: Light and shadow
chapter: Light
blurb: A whole scene in a table, the nearest hit for every pixel, and shadows — your own ray tracer.
---

One sphere is a demo. A **scene** is many — and a table is the perfect way to describe one: a row per sphere, with its centre, radius and colour.

```q
S:([] c:(0 0 3.5;-1.25 -0.35 4.4;1.3 -0.45 3.6;0 -101 4); r:1 0.65 0.55 100; col:(1 0.36 0.3;0.3 0.62 1;1 0.85 0.3;0.92 0.9 0.86))
S
```

The last sphere is huge (radius 100) and far below: it's our floor.

## The nearest hit

Put the hit test in a function, and run it for each sphere with `each`. That gives one row of distances per sphere:

```q
hit:{[s] b:sum s[`c]*dir; q:(b*b)-(sum s[`c]*s`c)-s[`r]*s`r; t:b-sqrt q; ?[(q>0)&t>0.001;t;0w]}
```

Then for every pixel, the nearest sphere wins:

- `t:min T` — the smallest distance in each column,
- `k:sum (til count S)*T=\:t` — *which* sphere that was (the row where `T` equals the minimum).

## Shadows

A point is in shadow if something sits between it and the light. So from every hit point, cast one more ray — toward the light — and test it against every sphere. Same maths, new origin:

```q
blocked:{[s] o:P-s`c; b:sum o*light; q:(b*b)-(sum o*o)-s[`r]*s`r; (q>0)&0.001<(neg b)+sqrt q}
```

## All together

```q sketch
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)

S:([] c:(0 0 3.5;-1.25 -0.35 4.4;1.3 -0.45 3.6;0 -101 4); r:1 0.65 0.55 100; col:(1 0.36 0.3;0.3 0.62 1;1 0.85 0.3;0.92 0.9 0.86))
light:unit -1 1.4 -0.8

hit:{[s] b:sum s[`c]*dir; q:(b*b)-(sum s[`c]*s`c)-s[`r]*s`r; t:b-sqrt q; ?[(q>0)&t>0.001;t;0w]}
T:hit each S
t:min T
k:sum (til count S)*T=\:t
P:dir*\:t
N:unit P-flip S[`c] k

blocked:{[s] o:P-s`c; b:sum o*light; q:(b*b)-(sum o*o)-s[`r]*s`r; (q>0)&0.001<(neg b)+sqrt q}
shadow:max blocked each S

lam:0|sum N*light
shade:0.12+0.88*lam*not shadow
col:(flip S[`col] k)*\:shade
sky:(0.35+0.4*py;0.55+0.35*py;0.95+0.05*py)
img:{?[t<0w;x;y]}'[col;sky]
pixels w cut/: img
```

That's a complete ray tracer — perspective, shading, multiple objects, shadows, sky — in about twenty lines, with **no loops over pixels at all**. Every line works on all 40,000 pixels at once.

Take a breath. A few lessons ago, `til 10` was new. Now you're writing the kind of code that renders films.

## Your turn

```q challenge
%% goal Add a fifth sphere to the scene table S — anywhere you like, in any colour.
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)
S:([] c:(0 0 3.5;-1.25 -0.35 4.4;1.3 -0.45 3.6;0 -101 4); r:1 0.65 0.55 100; col:(1 0.36 0.3;0.3 0.62 1;1 0.85 0.3;0.92 0.9 0.86))
light:unit -1 1.4 -0.8
hit:{[s] b:sum s[`c]*dir; q:(b*b)-(sum s[`c]*s`c)-s[`r]*s`r; t:b-sqrt q; ?[(q>0)&t>0.001;t;0w]}
T:hit each S
t:min T
k:sum (til count S)*T=\:t
N:unit (dir*\:t)-flip S[`c] k
col:(flip S[`col] k)*\:0.12+0.88*0|sum N*light
pixels w cut/: {?[t<0w;x;y]}'[col;(0.35+0.4*py;0.55+0.35*py;0.95+0.05*py)]
%% check 5=count S | S should have 5 rows — one per sphere.
%% check 1=drawn`pixels | Render the scene with pixels.
%% hint Add one more item to each column: a centre like 0.6 0.9 5, a radius, and a colour like 0.5 1 0.6.
%% solution
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)
S:([] c:(0 0 3.5;-1.25 -0.35 4.4;1.3 -0.45 3.6;0 -101 4;0.7 0.9 5); r:1 0.65 0.55 100 0.5; col:(1 0.36 0.3;0.3 0.62 1;1 0.85 0.3;0.92 0.9 0.86;0.5 1 0.6))
light:unit -1 1.4 -0.8
hit:{[s] b:sum s[`c]*dir; q:(b*b)-(sum s[`c]*s`c)-s[`r]*s`r; t:b-sqrt q; ?[(q>0)&t>0.001;t;0w]}
T:hit each S
t:min T
k:sum (til count S)*T=\:t
N:unit (dir*\:t)-flip S[`c] k
col:(flip S[`col] k)*\:0.12+0.88*0|sum N*light
pixels w cut/: {?[t<0w;x;y]}'[col;(0.35+0.4*py;0.55+0.35*py;0.95+0.05*py)]
```
