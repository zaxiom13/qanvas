/ @title Noise hills
/ @level worlds
/ @blurb Layers of Perlin noise make mountains.

x:til 601
draw:{
  background 250 225 190;
  pen `none;
  {[k]
    y:250+(60*k)+180*noise (x%160-30*k;k+time%4);   / q reads right to left, so (60*k) needs brackets
    ink hsb[0.62;0.35;0.9-0.18*k];
    poly (0,x,600;600,y,600)
  } each til 4
 }
