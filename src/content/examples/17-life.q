/ @title Game of Life
/ @level worlds
/ @blurb Conway's classic in a handful of whole-grid operations. Click to reseed.

n:60
world:n cut (n*n)?2            / a 60×60 grid of random 0s and 1s

step:{[w]
  v:(-1 0 1) rotate\: w;                          / shifted up, not at all, down
  nb:sum raze {(-1 0 1) {x rotate' y}\: x} each v;  / ...and left, right: 9 grids added up
  (nb=3) or w and nb=4                            / born with 3; survive with 2 or 3
 }

fps 12
draw:{
  if[mousedown; world::n cut (n*n)?2];
  world::step world;
  heatmap["f"$world;`ice]
 }
