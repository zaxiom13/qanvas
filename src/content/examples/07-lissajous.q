/ @title Lissajous
/ @level moving
/ @blurb Two sine waves at right angles draw endless loops.

t:tau*til[2000]%2000
draw:{
  background 10;
  p:center+240*(sin 3*t+time%3;sin 4*t);
  pen hsb[0.6+0.1*sin time;0.6;1]; weight 2; ink `none;
  path p
 }
