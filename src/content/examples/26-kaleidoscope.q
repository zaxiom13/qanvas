/ @title Kaleidoscope
/ @level moving
/ @blurb Draw with one finger and it is mirrored eight ways. Old strokes slowly fade away.

k:8
a:tau*til[k]%k                  / eight angles around the middle

setup:{background 10 8 20}

draw:{
  fade 5;
  if[mousedown;
    d:mouse-center; e:pmouse-center;
    pen hsb[time%6;0.7;1]; weight 5; glow 12;
    line[center+rot[a;e];center+rot[a;d]];                          / the stroke, turned k ways
    line[center+rot[a;(e 0;neg e 1)];center+rot[a;(d 0;neg d 1)]]]  / and its mirror image
 }
