/ Particle Fountain via qSQL — state IS a q table.
/
/ Each frame we `update` velocities, positions, and life, then `delete` dead
/ particles. q's table semantics make this a one-liner per physics step.
/
/ Column is `pos` (not `p`) so expressions like `last each pos` stay unambiguous
/ beside the table variable `p`.

setup:{
  / preallocate empty table; rows appended each frame from the mouse
  `size`bg`particles!(900 640; Color.NIGHT; ([]pos:();v:();life:();hue:()))
 }

draw:{[state;frameInfo;input;canvas]
  p:state`particles;
  m:$[null~input`mouse; 0.5*canvas`size; input`mouse];

  / spawn 8 new particles per frame around the mouse
  ang:2*acos[-1]*(8?1f);
  sp:2+8?3f;
  newp:([]
    pos:8#enlist m;
    v:flip (sp*cos ang; (sp*sin ang)-6f);
    life:8#120;
    hue:8?360);
  p:p,newp;

  / integrate
  p:update pos:pos+v, v:v+(count v)#enlist (0f;0.18), life:life-1 from p;
  p:delete from p where life<=0;
  p:delete from p where (last each pos)>last canvas`size;

  / render
  background[Color.NIGHT];
  r:2+0.02*p`life;
  a:(p`life)%120f;
  h:p`hue;
  fill:(65536*floor 255*0.5+0.5*sin 0.017*h)
      +(256*floor 255*0.5+0.5*sin 0.013*h+2)
      +(floor 255*0.5+0.5*sin 0.019*h+4);

  circle[([]
    p:p`pos;
    r:r;
    fill:fill;
    alpha:a
  )];

  `size`bg`particles!(state`size;state`bg;p)
 }
