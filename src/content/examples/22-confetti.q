/ @title Confetti
/ @level moving
/ @blurb Tap anywhere for a burst. Every piece of confetti is one item in a few arrays.

p:(0#0f;0#0f)                  / positions, as rows (xs;ys)
v:(0#0f;0#0f)                  / velocities
hue:0#0f

draw:{
  background `night;
  if[clicked;
    k:80;
    a:k?tau; s:3+k?9f;
    p::(p[0],k#mouse 0;p[1],k#mouse 1);
    v::(v[0],s*cos a;v[1],(s*sin a)-5);
    hue,:k?1f;
    buzz 15];
  v[1]+:0.25;                  / gravity, for every piece at once
  v*:0.99;
  p+:v;
  keep:where p[1]<640;         / forget pieces that fell off the bottom
  p::p[;keep]; v::v[;keep]; hue::hue keep;
  ink hsb[hue;0.75;1];
  rect[p;10 6];
  if[0=count hue; ink 120; font 30; align `center`middle; text[center;"tap!"]]
 }
