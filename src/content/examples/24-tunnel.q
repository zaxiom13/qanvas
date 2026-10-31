/ @title Neon tunnel
/ @level arrays
/ @blurb Thirty rings rushing past. Drag or tilt to steer down the tunnel.

n:30

draw:{
  background 6 4 14;
  z:(til[n]+3*time) mod n;            / each ring's depth, sliding toward you
  aim:$[0<sum abs tilt; center+250*tilt; mouse];
  c:center+(aim-center)*\:z%n;        / near rings follow your aim more
  ink `none;
  pen hsb[(z%n)+time%8;0.85;1];
  weight 1+z%4;
  glow 18;
  circle[c;3*z*z%2]
 }
