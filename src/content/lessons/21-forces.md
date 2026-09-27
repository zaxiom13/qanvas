---
title: Forces
chapter: Nature
blurb: Position, velocity, acceleration — Newton's laws for a whole crowd at once.
---

In *The Nature of Code*, every moving thing carries three vectors:

- **position** `p` — where it is,
- **velocity** `v` — how far it moves each frame,
- **acceleration** — how much the velocity changes each frame.

Each frame: add the acceleration to `v`, then add `v` to `p`. A **force** is just an acceleration — and forces add up.

```q sketch
n:300
p:(n?600f;n?200f)
v:(n#0f;n#0f)
mass:1+n?4f
draw:{
  background 18 18 28;
  gravity:0 0.2;
  wind:$[mousedown;0.3 0;0 0];
  v+:gravity+wind%\:mass;
  v*:0.99;
  p+:v;
  bounce:p[1]>590;
  v[1]:?[bounce;-0.7*v 1;v 1];
  p[1]:590&p 1;
  p[0]:p[0] mod 600;
  ink hsb[0.6-0.1*mass;0.5;1];
  circle[p;2*mass]
 }
```

Hold the mouse down for wind.

- Gravity pulls everything equally.
- Wind is divided by mass, so heavy balls barely budge: `wind%\:mass` divides each part of the wind by every mass.
- `v*:0.99` is air resistance: everything loses a little speed.

## Attraction

A force can point somewhere. The arrow from each particle to the mouse is `mouse-p`; `unit` shrinks each arrow to length 1, so everyone feels the same pull:

```q sketch
n:800
p:(n?600f;n?600f)
v:(n#0f;n#0f)
draw:{
  background 10 10 20 60;
  a:0.6*unit mouse-p;
  v::0.97*v+a;
  p+:v;
  ink hsb[0.55+0.05*norm v;0.6;1];
  circle[p;2]
 }
```

Eight hundred particles, each with its own position and velocity, and the whole update is three lines.

## Your turn

```q challenge
%% goal Add gravity: every frame, add 0 0.3 to the velocities of all the balls.
n:50
p:(20+11*til n;n#50f)
v:(n#0f;n#0f)
draw:{
  background 20;
  p+:v;
  ink `sky;
  circle[p;5]
 }
%% check all 0<v 1 | Every ball should be speeding downward — add 0 0.3 to v each frame.
%% hint Add v+:0 0.3; on the line before p+:v.
%% solution
n:50
p:(20+11*til n;n#50f)
v:(n#0f;n#0f)
draw:{
  background 20;
  v+:0 0.3;
  p+:v;
  ink `sky;
  circle[p;5]
 }
```
