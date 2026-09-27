---
title: Animation
chapter: Motion
blurb: Define draw, and Qanvas calls it sixty times a second.
---

Everything so far has been a still picture. To animate, define a function called `draw`. Qanvas calls it about 60 times a second, and each call paints one frame.

```q sketch
draw:{
  background 20;
  ink `coral;
  circle[(frame mod 600;300);40]
 }
```

`frame` counts the frames drawn so far: 0, 1, 2, … `frame mod 600` wraps it back to 0 when it reaches 600, so the circle keeps crossing the screen.

> **Heads up:** remember the `;` at the end of each line inside `draw`.

## Time and waves

`time` is the number of seconds since the sketch started. Feed it to `sin` and you get a smooth swing between -1 and 1:

```q
sin 0 0.5 1 1.5 2
```

Scale the swing and you have motion that breathes:

```q sketch
draw:{
  background 20;
  ink 255 190 110;
  circle[center;120+60*sin 2*time]
 }
```

## Many things, each with its own rhythm

Because everything is arrays, giving each shape its own timing is one expression. Here, every circle's phase depends on its position in the list:

```q sketch
n:30
xs:10+20*til n
draw:{
  background 15 14 30;
  ys:300+120*sin (2*time)+til[n]%4;
  ink hsb[til[n]%n;0.6;1];
  circle[(xs;ys);8]
 }
```

That's a wave made of 30 circles, and not a loop in sight.

## Trails

If you don't call `background` every frame, the old frames stay. Draw a see-through background instead, and the past fades slowly:

```q sketch
draw:{
  background 20 20 30 25;
  ink hsb[time%4;0.7;1];
  circle[center+180*(cos 1.3*time;sin 2*time);14]
 }
```

## Your turn

```q challenge
%% goal Make a circle that moves back and forth horizontally across the middle of the canvas, forever.
draw:{
  background 20;
  circle[center;30]
 }
%% check 1<=drawn`circle | Keep drawing one circle each frame.
%% check 100<abs (first arg[`circle;0])-300 | The circle should swing well away from the middle — try x = 300+250*cos 2*time.
%% hint The position is (x;y). Keep y at 300 and let x be 300 plus a sine wave.
%% hint cos starts at 1, so 300+250*cos 2*time begins at the right edge and swings to the left.
%% solution
draw:{
  background 20;
  ink `mint;
  circle[(300+250*cos 2*time;300);30]
 }
```
