/ @title Flow field
/ @level worlds
/ @blurb Perlin noise becomes wind. 1500 particles leave silky trails.

n:1500
p:(n?600f;n?600f)

setup:{background 14 13 22}

draw:{
  a:3*tau*noise (p[0]%240;p[1]%240;time%12);
  p::(p+(cos a;sin a)) mod 600;      / step along the wind, wrapping at the edges
  ink hsb[0.5+a%4*tau;0.5;1],18;
  circle[p;1]
 }
