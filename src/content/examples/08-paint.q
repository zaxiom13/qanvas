/ @title Painter
/ @level moving
/ @blurb Drag to paint. Nothing is cleared, so every stroke stays.

setup:{background 245 240 230}
draw:{
  if[mousedown;
    d:dist[mouse;pmouse];
    pen hsb[time%10;0.7;0.9]; weight 4+d%3;
    line[pmouse;mouse]]
 }
