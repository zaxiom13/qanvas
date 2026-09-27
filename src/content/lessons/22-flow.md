---
title: Flow fields
chapter: Nature
blurb: Turn noise into wind, and let a thousand particles ride it.
---

A **flow field** gives every spot on the canvas a direction. Particles look up the direction where they are and take a small step. Where do the directions come from? Noise — so neighbouring spots point almost the same way, and the flow is smooth.

First let's *see* the field: a grid of short lines, each pointing along the noise angle.

```q sketch
g:15+30*grid[20;20]
a:tau*2*noise g%200
background 245 240 230
pen 60; weight 2
line[g;g+12*(cos a;sin a)]
```

Now let particles ride it. Without clearing the background, their paths build up into silk:

```q sketch
n:1500
p:(n?600f;n?600f)
setup:{background 14 13 22}
draw:{
  a:tau*2*noise p%200;
  p::(p+(cos a;sin a)) mod 600;
  ink 255 255 255 14;
  circle[p;1]
 }
```

- `noise p%200` looks up one noise value per particle.
- `(cos a;sin a)` turns each angle into a step of length 1.
- `mod 600` wraps anyone who wanders off the edge back onto the other side.

> **Try it:** change `200` to `60` for tighter swirls, or add `time%10` as a third noise coordinate so the wind shifts slowly over time.

## Your turn

```q challenge
%% goal Colour each particle by the direction it's travelling in, using hsb.
n:1500
p:(n?600f;n?600f)
setup:{background 14 13 22}
draw:{
  a:tau*2*noise p%200;
  p::(p+(cos a;sin a)) mod 600;
  ink 255 255 255 14;
  circle[p;1]
 }
%% check $[0>type c:arg[`ink;0];0b;100<count distinct flip c] | Give each particle its own colour from its angle.
%% hint hsb[a%tau;0.6;1] maps each angle to a hue. Add ,14 on the end to keep the trails see-through.
%% solution
n:1500
p:(n?600f;n?600f)
setup:{background 14 13 22}
draw:{
  a:tau*2*noise p%200;
  p::(p+(cos a;sin a)) mod 600;
  ink hsb[a%tau;0.6;1],14;
  circle[p;1]
 }
```
