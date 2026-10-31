/ @title Metro map
/ @level worlds
/ @blurb Ten coloured lines that only ever turn by 45°, like a transit map. Tap for a new city.

route:{[c]
  turns:12?-1 0 0 0 1;                     / mostly straight on
  heading:(first 1?8)+sums turns;          / directions, in eighths of a turn
  a:heading*pi%4;
  len:40*1+12?2;
  x0:80+first 1?440f; y0:80+first 1?440f;
  pts:(x0,x0+sums len*cos a;y0,y0+sums len*sin a);
  pen c; weight 9; ink `none; path pts;
  i:2*til 7;                               / a station at every other corner
  pen 40; weight 3; ink 255;
  circle[(pts[0] i;pts[1] i);6]}

city:{background 246 243 236; route each palette `metro}

setup:{city[]}
draw:{if[clicked; city[]; buzz 10]}
