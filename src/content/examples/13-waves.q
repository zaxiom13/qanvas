/ @title Table of waves
/ @level arrays
/ @blurb A q table drives the drawing: one row per wave.

waves:([] f:1 2 3 5; amp:60 40 30 20; col:`coral`lemon`mint`sky)
x:til 600

draw:{
  background 14 13 22;
  weight 3; ink `none;
  {[r] pen r`col; path (x;300+r[`amp]*sin time+x*r[`f]%95)} each waves
 }
