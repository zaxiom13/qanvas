/ Particle Fountain via qSQL — state IS a q table.
/
/ Each frame we `update` velocities, positions, and life, then `delete` dead
/ particles. q's table semantics make this a one-liner per physics step.

setup:{
  / preallocate empty table; rows appended each frame from the mouse
  `size`bg`particles!(900 640; Color.NIGHT; ([]p:();v:();life:();hue:()))
 }

draw:{[state;frameInfo;input;canvas]
  p:state`particles;
  m:$[null~input`mouse; 0.5*canvas`size; input`mouse];

  / spawn 8 new particles per frame around the mouse
  ang:2*acos[-1]*(8?1f);
  sp:2+6?3f;
  newp:([]
    p:8#enlist m;
    v:flip (sp*cos ang; (sp*sin ang)-6f);
    life:8#120;
    hue:8?360);
  p:p,newp;

  / integrate
  p:update p:p+v, v:v+(count v)#enlist (0f;0.18), life:life-1 from p;
  p:delete from p where life<=0;
  p:delete from p where last each p`p>last canvas`size;

  / render
  background[Color.NIGHT];
  r:2+0.02*p`life;
  a:p[`life]%120f;
  hueToRgb:{[h] rgb:(((h%60)mod 2)-1); 0};  / placeholder for clarity
  fill:(65536*floor 255*0.5+0.5*sin 0.017*p`hue)
      +(256*floor 255*0.5+0.5*sin 0.013*p`hue+2)
      +(floor 255*0.5+0.5*sin 0.019*p`hue+4);

  circle[([]
    p:p`p;
    r:r;
    fill:fill;
    alpha:a
  )];

  update particles:p from state
 }
