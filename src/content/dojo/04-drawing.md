---
title: Drawing puzzles
chapter: Dojo
blurb: Picture puzzles — each one a few array expressions.
---

```q challenge
%% title Checkerboard
%% level warmup
%% goal Draw an 8×8 checkerboard of 75-pixel squares, alternating two colours.
background 20
ink 240
rect[0 0;75]
%% check 64=drawn`rect | Draw all 64 squares.
%% check 2=count distinct flip arg[`ink;0] | Use exactly two colours, one per square, as rows (r;g;b).
%% hint g:grid[8;8] gives the 64 squares' row and column numbers. (g[0]+g[1]) mod 2 alternates 0 1 0 1…
%% hint ink gray 240*(g[0]+g[1]) mod 2 gives one gray per square.
%% solution
g:grid[8;8]
background 20
ink gray 40+200*(g[0]+g[1]) mod 2
rect[75*g;75]
```

```q challenge
%% title Target
%% level warmup
%% goal Draw a target: 6 rings, from radius 270 down to 45, alternating coral and white. One circle call.
background 20
ink `coral
circle[center;270]
%% check 6=drawn`circle | Draw 6 circles with one call.
%% check 270 225 180 135 90 45~"j"$arg[`circle;1] | Radii should run 270 225 180 135 90 45 — biggest first, so smaller ones draw on top.
%% hint 270-45*til 6 builds the radii.
%% hint For alternating colours, give ink a list: 6#`coral`white
%% solution
background 20
ink 6#`coral`white
circle[center;270-45*til 6]
```

```q challenge
%% title Sine of dots
%% level warmup
%% goal Draw 60 dots along one full sine wave across the canvas.
background 20
ink `sky
circle[(10*til 60;300);5]
%% check 60=drawn`circle | Draw 60 dots.
%% check 150<(max last arg[`circle;0])-min last arg[`circle;0] | The dots should rise and fall — make y a sine wave.
%% hint Map the dot numbers onto one full turn: tau*til[60]%60.
%% solution
background 20
ink `sky
circle[(10*til 60;300+120*sin tau*til[60]%60);5]
```

```q challenge
%% title Spiral
%% level core
%% goal Draw a spiral of 200 dots: each dot a little further round and a little further out than the last.
background 20
ink `lemon
circle[center;4]
%% check 200=drawn`circle | Draw 200 dots.
%% check 150<max norm (arg[`circle;0])-center | The spiral should reach at least 150 pixels from the centre.
%% hint Let i be til 200. The angle can be 0.2*i and the radius 1.2*i.
%% solution
i:til 200
background 20
ink `lemon
circle[center+(1.2*i*cos 0.2*i;1.2*i*sin 0.2*i);4]
```

```q challenge
%% title Clock face
%% level core
%% goal Draw 60 tick lines around a clock face — every fifth one (the hours) longer and thicker.
background 245 240 230
pen 30
line[center;center+200 0]
%% check 60=drawn`line | Draw 60 ticks with one line call.
%% check 2=count distinct arg[`weight;0] | Give the ticks two different weights — thick for hours, thin for minutes.
%% hint a:tau*til[60]%60 are the angles; hour:0=til[60] mod 5 marks the hours.
%% hint The inner end of each tick is at radius ?[hour;190;215]; the outer end at 240.
%% solution
a:tau*til[60]%60
hour:0=til[60] mod 5
r0:?[hour;190;215]
background 245 240 230
pen 30
weight ?[hour;6;2]
line[center+(r0*cos a;r0*sin a);center+(240*cos a;240*sin a)]
```

```q challenge
%% title Colour field
%% level core
%% goal Fill the canvas with a 20×20 grid of squares, where hue follows x and brightness follows y.
background 20
rect[0 0;30]
%% check 400=drawn`rect | Draw 400 squares.
%% check 300<count distinct flip arg[`ink;0] | Give every square its own colour with hsb.
%% hint g:grid[20;20]; then hsb[g[0]%20;0.8;1-g[1]%25]
%% solution
g:grid[20;20]
background 20
ink hsb[g[0]%20;0.8;1-g[1]%25]
rect[30*g;30]
```
