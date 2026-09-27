---
title: Swarms
chapter: Nature
blurb: Simple steering rules, applied to everyone at once — and a flock appears.
---

In 1986 Craig Reynolds showed that flocks need only a few simple rules. Here are two, applied to 300 creatures in one go:

1. **Cohesion** — steer toward the centre of the flock.
2. **Seek** — steer toward the mouse.

The centre of the flock is the average x and the average y. `avg each` averages each row:

```q
p:(1 2 3f;10 20 60f)
avg each p
```

Subtract every creature's position from the centre and you have an arrow from each creature to the middle:

```q sketch
n:300
p:(n?600f;n?600f)
v:(-1+n?2f;-1+n?2f)
draw:{
  background 8 10 20;
  toC:(avg each p)-p;
  toM:mouse-p;
  v+:(0.0005*toC)+0.002*toM;
  v::v*\:3%3|norm v;
  p+:v;
  ink hsb[0.5+0.1*angle v;0.6;1];
  circle[p;3]
 }
```

That speed-limit line deserves a closer look, reading right to left:

- `norm v` — every creature's speed,
- `3|` — at least 3,
- `3%` — so 3 divided by it is at most 1,
- `v*\:` — shrink each creature's velocity by its own factor.

Anyone going faster than 3 is slowed down to exactly 3; everyone else is untouched.

## Pointing the way

Circles don't show which way something is heading. A short line from `p` along `v` does:

```q sketch
n:200
p:(n?600f;n?600f)
v:(-1+n?2f;-1+n?2f)
draw:{
  background 8 10 20;
  v+:0.002*mouse-p;
  v::v*\:3%3|norm v;
  p+:v;
  pen hsb[0.5+0.1*angle v;0.6;1]; weight 2;
  line[p;p+4*v]
 }
```

## Your turn

```q challenge
%% goal Make the creatures flee: steer away from the mouse instead of toward it.
n:200
p:(n?600f;n?600f)
v:(n#0f;n#0f)
draw:{
  background 8 10 20;
  v+:0.002*mouse-p;
  p+:v;
  ink `mint;
  circle[p;3]
 }
%% check 0>avg dot[v;mouse-p] | On average, velocities should point away from the mouse.
%% hint Flip the direction of the steering arrow: p-mouse instead of mouse-p.
%% solution
n:200
p:(n?600f;n?600f)
v:(n#0f;n#0f)
draw:{
  background 8 10 20;
  v+:0.002*p-mouse;
  p+:v;
  ink `mint;
  circle[p;3]
 }
```
