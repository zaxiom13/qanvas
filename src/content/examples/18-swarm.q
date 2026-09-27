/ @title Swarm
/ @level worlds
/ @blurb Every bird steers toward the flock and the mouse — all as array maths.

n:300
p:(n?600f;n?600f)
v:(-1+n?2f;-1+n?2f)

draw:{
  background 8 10 20;
  toC:(avg each p)-p;           / toward the centre of the flock
  toM:mouse-p;                  / toward the mouse
  v+:(0.0005*toC)+0.002*toM;
  v::v*\:3%3|norm v;            / cap everyone's speed at 3
  p+:v;
  ink hsb[0.5+0.1*angle v;0.6;1];
  circle[p;3]
 }
