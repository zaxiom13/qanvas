/ @title Bubbles
/ @level moving
/ @blurb Pop them! Each bubble is one item in three arrays, and every pop plays a note.

n:24
r:14+n?30f
p:(n?600f;600+n?600f)
popped:0

draw:{
  background 12 32 54;
  p[1]-:1+r%25;                         / big bubbles rise faster
  p[0]+:0.6*sin time+r;                 / and wobble
  if[clicked;
    hit:where dist[p;mouse]<r;
    if[count hit;
      p[1;hit]:(count hit)#680f;
      popped+:count hit;
      note 72+popped mod 12; buzz 20]];
  top:where p[1]<neg r;
  p[1;top]:(count top)#650f;
  ink 255 255 255 35; pen 190 225 255; weight 2;
  circle[p;r];
  pen `none; ink 255 255 255 170;
  circle[p-0.35*(r;r);0.2*r];
  ink 220; font 22; align `left`top; text[16 16;"popped: ",string popped]
 }
