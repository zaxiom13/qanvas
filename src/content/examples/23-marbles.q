/ @title Marbles
/ @level moving
/ @blurb Tilt your phone to roll them and shake to scatter. On a computer, hold the mouse to pull them.

n:14
r:16+n?20f                     / radii
p:(r+n?600f-2*r;r+n?600f-2*r)  / positions (xs;ys)
v:(n#0f;n#0f)                  / velocities

/ keep one axis inside the box: bounce, losing a little speed
wall:{[x;v;r] out:(x<r) or x>600-r; (r|(600-r)&x; ?[out;-0.7*v;v])}

draw:{
  background 22 20 34;
  g:$[0<sum abs tilt; 0.7*tilt; mousedown; 0.004*mouse-p; 0 0.35];
  v+:g;
  if[shake>0.3; v+:10*shake*(-1+n?2f;-1+n?2f)];
  v*:0.985;
  p+:v;
  a:wall[p 0;v 0;r]; b:wall[p 1;v 1;r];
  p::(a 0;b 0); v::(a 1;b 1);
  ink palette `candy; glow 14;
  circle[p;r];
  glow 0; ink 255 255 255 90;
  circle[p-0.3*(r;r);0.25*r]   / a shine on each marble
 }
