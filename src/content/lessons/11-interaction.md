---
title: Poke it
chapter: Motion
blurb: The mouse, the keyboard and your fingers.
---

`mouse` is the pointer's position as a point, refreshed every frame:

```q sketch
draw:{
  background 20;
  ink `lemon;
  circle[mouse;30]
 }
```

Move your pointer over the canvas — or drag a finger, on a phone.

`mousedown` is `1b` while the button (or a finger) is down, and `clicked` is `1b` only on the frame a click begins:

```q sketch
r:30f
draw:{
  background 20;
  if[clicked; r::10+rand 80];
  ink $[mousedown;`coral;`sky];
  circle[mouse;r]
 }
```

## Painting

`pmouse` is where the pointer was on the previous frame. A line from `pmouse` to `mouse` makes a smooth stroke. Leave out `background` and every stroke stays:

```q sketch
setup:{background 245 240 230}
draw:{
  if[mousedown;
    pen hsb[time%6;0.7;0.9];
    weight 8;
    line[pmouse;mouse]]
 }
```

`setup` is optional. If you define it, it runs once, before the first frame.

## The keyboard

`held` lists the keys being held down right now, as symbols like `` `left `` or `` `a ``. Click the canvas first so it has the keyboard's attention.

```q sketch
p:300 300f
draw:{
  background 20;
  step:0 0f;
  if[`left in held; step+:-5 0];
  if[`right in held; step+:5 0];
  if[`up in held; step+:0 -5];
  if[`down in held; step+:0 5];
  p+:step;
  ink `mint;
  circle[p;25]
 }
```

## Your turn

```q challenge
%% goal Draw a ring of 12 small circles that always surrounds the mouse pointer.
draw:{
  background 20;
  a:6.28*til[12]%12;
  circle[center+(80*cos a;80*sin a);10]
 }
%% check 12=drawn`circle | Draw 12 circles each frame.
%% check 1>abs (first mouse)-avg first arg[`circle;0] | Centre the ring on mouse instead of center.
%% hint One word needs to change.
%% solution
draw:{
  background 20;
  a:6.28*til[12]%12;
  ink `sky;
  circle[mouse+(80*cos a;80*sin a);10]
 }
```
