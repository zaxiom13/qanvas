/ @title Orbits
/ @level moving
/ @blurb Polar coordinates: an angle and a radius become x and y.

n:12
r:40+21*til n                  / twelve orbit radii

draw:{
  background 12 11 28;
  a:time*0.6*1+til n;          / each planet has its own speed
  p:center+(r*cos a;r*sin a);  / where each planet is now
  pen 255 255 255 30; ink `none; circle[center;r];
  pen `none; ink hsb[til[n]%n;0.5;1]; circle[p;5+0.6*til n]
 }
