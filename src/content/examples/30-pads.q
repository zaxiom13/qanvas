/ @title Pocket synth
/ @level moving
/ @blurb Sixteen pads playing sixteen notes of a pentatonic scale. Tap to play.

g:grid[4;4]                                  / 16 pads as rows (cols;rows)
notes:60+0 2 4 7 9 12 14 16 19 21 24 26 28 31 33 36
lit:16#0f

draw:{
  background 18 16 24;
  if[clicked;
    i:(floor mouse[0]%150)+4*floor mouse[1]%150;
    if[(i>=0) and i<16; lit[i]:1f; note notes i; buzz 12]];
  lit*:0.92;                                 / every pad dims a little each frame
  glow 20;
  ink hsb[(g[0]%4)+g[1]%16;0.75;0.25+0.75*lit];
  rect[15+150*g;120]
 }
