---
title: Noise
chapter: Nature
blurb: Randomness that remembers. Perlin noise makes hills, clouds and wandering things.
---

Random numbers jump about with no memory of what came before:

```q sketch
x:til 600
background 250 247 240
pen `coral; weight 2; ink `none
path (x;300+100*-1+2*600?1f)
```

`noise` is different. Nearby inputs give nearby outputs — smooth randomness, invented by Ken Perlin for the film *Tron*. It always returns a number between 0 and 1:

```q
noise 0.1 0.11 0.12 5.0
```

```q sketch
x:til 600
background 250 247 240
pen `indigo; weight 3; ink `none
path (x;100+400*noise x%120)
```

Dividing `x` by 120 sets the **scale**: divide by a lot and the line changes slowly; divide by a little and it wiggles. Try `x%30`.

## Noise in two dimensions

Give noise rows of points and you get a smooth landscape of values. Here's a 120×120 grid of noise, painted like a map:

```q sketch
g:grid[120;120]
heatmap[120 cut noise g%25;`ocean]
```

## Noise in time

Add `time` as another coordinate and the noise flows. This wanderer takes its x and y from two different places in the noise:

```q sketch
setup:{background 245 240 230}
draw:{
  p:600*noise (time*0.3;100+time*0.3);
  ink 40 40 60 60;
  circle[p;6]
 }
```

## Your turn

```q challenge
%% goal Draw a mountain range: one filled poly whose top edge follows noise across the whole canvas.
x:til 601
background 200 220 240
ink 60 80 110
poly (0,x,600;600,(601#400),600)
%% check 1=drawn`poly | Draw one filled poly.
%% check 8<dev "f"$1_-1_last arg[`poly;0] | Make the skyline bumpy — set its heights from noise, like 150+300*noise x%100.
%% hint Replace the flat heights (601#400) with something built from noise x%100.
%% solution
x:til 601
background 200 220 240
ink 60 80 110
poly (0,x,600;600,(150+300*noise x%100),600)
```
