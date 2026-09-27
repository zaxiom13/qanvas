/ @title Golden spiral
/ @level arrays
/ @blurb Sunflower seeds: each one turns by the golden angle.

n:900
i:1+til n
a:i*pi*3-sqrt 5               / the golden angle, in radians
r:9*sqrt i
draw:{
  background 12 16 12;
  ink hsb[0.12+i%6000;0.8;0.6+0.4*sin a+time];
  circle[center+(r*cos a+0.1*time;r*sin a+0.1*time);2+i%400]
 }
