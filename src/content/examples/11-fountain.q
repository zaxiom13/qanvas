/ @title Fountain
/ @level arrays
/ @blurb 800 particles moved by whole-array arithmetic. Hold the mouse to aim.

n:800
p:(n#300f;n#560f)
v:(-2+n?4f;-14+n?6f)
life:n?1f

draw:{
  background 10 10 18;
  src:$[mousedown;mouse;300 560f];
  v[1]+:0.25;                   / gravity pulls on every particle
  p+:v;                         / every particle moves
  life-:0.012;
  dead:where (life<0) or p[1]>620;
  k:count dead;
  p[0;dead]:k#src 0; p[1;dead]:k#src 1;       / respawn the dead ones
  v[0;dead]:-2+k?4f; v[1;dead]:-14+k?6f;
  life[dead]:1f;
  ink hsb[0.02+0.12*life;0.85;1];
  circle[p;1+4*life]
 }
