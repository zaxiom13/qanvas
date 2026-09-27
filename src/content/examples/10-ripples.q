/ @title Ripples
/ @level arrays
/ @blurb A 15×15 grid of dots, each sized by its distance to the mouse.

g:20+40*grid[15;15]            / 225 points as rows (xs;ys)

draw:{
  background 10 12 20;
  d:dist[g;mouse];             / 225 distances, all at once
  r:3+15*0.5+0.5*sin (d%28)-4*time;
  ink hsb[0.55+d%1400;0.6;1];
  circle[g;r]
 }
