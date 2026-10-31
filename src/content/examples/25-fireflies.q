/ @title Fireflies
/ @level worlds
/ @blurb Sixty fireflies drifting on noise, each blinking on its own clock. Touch to call them over.

n:60
p:(n?600f;n?600f)
seed:n?100f

draw:{
  background 6 10 18;
  a:tau*noise (seed+0.004*frame;seed);     / a smooth random heading for each
  p+:1.6*(cos a;sin a);
  if[mousedown; p+:0.03*mouse-p];
  p::p mod 600;                            / fly off one edge, in at the other
  blink:0.5+0.5*sin seed+2.5*time;
  glow 22;
  ink (255;225;110;40+215*blink);
  circle[p;1.5+3*blink]
 }
