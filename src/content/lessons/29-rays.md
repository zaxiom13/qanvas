---
title: Rays
chapter: Light
blurb: Trace a ray through every pixel at once, and a sphere appears out of nothing but maths.
---

A ray tracer asks one question for every pixel: *if I look through this pixel, what do I see?* Most ray tracers ask it pixel by pixel, in a loop. We'll ask all 40,000 pixels at once.

## One ray per pixel

The eye sits at `0 0 0`, looking along z. For every pixel we make a direction — a little across (x), a little up (y), and one step forward (z). In 3D, points are simply three rows: `(xs;ys;zs)`.

```q
w:4; h:4
px:(til[w*h] mod w)%w
py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)
count each dir
```

Three rows of 16: one direction per pixel. `unit` makes each one length 1.

## Hitting a sphere

Put a sphere with centre `c` and radius `r` in front of the eye. For a ray from the eye in direction `d`, a bit of school geometry gives:

- `b` — how far along the ray the centre lies: `c·d`
- `q` — `b² − (|c|² − r²)`. If `q` is negative, the ray misses.
- `t` — the distance to the hit: `b − √q`

The dot product `c·d` for *every* ray is `sum c*dir` — the three rows times three numbers, added up:

```q sketch
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)
c:0 0 3f; r:1
b:sum c*dir
q:(b*b)-(sum c*c)-r*r
pixels w cut "f"$q>0
```

A white disc: every pixel whose ray touches the sphere.

## Shading

To look round, we need to know which way the surface faces at each hit. The hit point is `P = t·d`, and the **normal** — the direction the surface faces — is `P − c`, scaled to length 1. The brightness is how squarely the normal faces the light: one more dot product.

```q sketch
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)
c:0 0 3f; r:1
light:unit -1 1 -1
b:sum c*dir
q:(b*b)-(sum c*c)-r*r
t:?[q>0;b-sqrt q;0w]
P:dir*\:t
N:unit P-c
lam:0|sum N*light
img:?[t<0w;0.1+0.9*lam;0]
pixels w cut img
```

- `?[q>0;b-sqrt q;0w]` — the hit distance for every pixel, or infinity for a miss.
- `P:dir*\:t` — each ray scaled by its own distance.
- `0|` — surfaces facing away from the light get no light, rather than negative light.

## Your turn

```q challenge
%% goal Make the sphere coral: draw pixels from three channels (red;green;blue), where green is 0.4*img and blue is 0.3*img.
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)
c:0 0 3f; r:1
light:unit -1 1 -1
b:sum c*dir
q:(b*b)-(sum c*c)-r*r
t:?[q>0;b-sqrt q;0w]
N:unit (dir*\:t)-c
img:?[t<0w;0.1+0.9*0|sum N*light;0]
pixels w cut img
%% check 3=count arg[`pixels;0] | Give pixels three matrices: (red;green;blue).
%% check (last arg[`pixels;0])~w cut 0.3*img | Blue should be 0.3*img.
%% hint w cut/: (img;0.4*img;0.3*img) cuts each channel into rows.
%% solution
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)
c:0 0 3f; r:1
light:unit -1 1 -1
b:sum c*dir
q:(b*b)-(sum c*c)-r*r
t:?[q>0;b-sqrt q;0w]
N:unit (dir*\:t)-c
img:?[t<0w;0.1+0.9*0|sum N*light;0]
pixels w cut/: (img;0.4*img;0.3*img)
```
