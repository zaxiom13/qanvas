---
title: qSQL in motion
chapter: Data
blurb: A particle system that lives in a table, updated sixty times a second.
---

`update` changes columns (or adds new ones) and returns a new table:

```q
t:([] n:1 2 3 4)
update m:n*10 from t
```

With a `where`, only matching rows change:

```q
update n:0 from t where n>2
```

`delete` removes rows:

```q
delete from t where n=2
```

## A particle table

Let's build a fountain as a table. Each row is a particle with a position `p`, a velocity `v` and a `life` that ticks down. Every frame is three small queries:

```q sketch
spawn:{[k] ([] p:k#enlist 300 560f; v:flip (-2+k?4f;-12+k?5f); life:k#1f)}
world:spawn 0
draw:{
  background 12 12 22;
  world,:spawn 8;
  world::update p:p+v, v:v+\:0 0.25, life:life-0.01 from world;
  world::delete from world where (life<0) or 620<last each p;
  circle update r:2+4*life, ink:flip hsb[0.05+0.1*life;0.8;1] from world
 }
```

Look at the physics line: one `update` moves *every* particle, pulls every velocity down with gravity, and ages every particle.

- `world,:spawn 8` appends 8 new rows.
- `v+\:0 0.25` uses each-left, because `v` is a column of pairs: each pair gets `0 0.25` added.
- `flip hsb[…]` turns three rows of colour into one colour per particle.

> **Why tables?** In kdb+, tables hold billions of rows of real data — trades, sensor readings, telemetry. The `select`, `update` and `delete` you're using for particles are the same ones running some of the fastest time-series databases in the world.

## Your turn

```q challenge
%% goal Use update to move every ball 100 pixels to the right (keep the result in balls), then draw the table.
balls:([] p:(100 100;100 300;100 500); r:30 40 50)
background 20
ink `sky
circle balls
%% check all 200=first each exec p from balls | Move every ball 100 pixels right with update, and keep the result in balls.
%% hint balls:update p:p+\:100 0 from balls
%% solution
balls:([] p:(100 100;100 300;100 500); r:30 40 50)
balls:update p:p+\:100 0 from balls
background 20
ink `sky
circle balls
```
