/ Array Heatmap — showcases q's vectorized tabular math.
/
/ Build a grid of cells, compute a distance field from the mouse, map values
/ to colors with a single expression, and emit one rect call per frame.
/ No per-cell loops; q does the whole thing in parallel.

setup:{
  `size`bg`nc`nr!(720 540; 0x0D0D1F; 48; 36)
 }

draw:{[state;frameInfo;input;canvas]
  nc:state`nc; nr:state`nr;
  cs:canvas`size;
  tw:first[cs]%nc; th:last[cs]%nr;

  / centre point for each cell (vectorised)
  xs:tw*0.5+til nc;
  ys:th*0.5+til nr;
  px:raze nr#enlist xs;
  py:raze each ys,'\:til nc;

  / mouse → treat null as centre
  m:$[null~input`mouse; 0.5*cs; input`mouse];
  dx:px-first m; dy:py-last m;
  d:sqrt(dx*dx)+dy*dy;

  / time-shifted hue field
  t:0.04*frameInfo`frameNum;
  v:0.5+0.5*sin 0.02*d+1000*t;

  r:floor 255*v;
  g:floor 255*1-v;
  b:floor 200*0.5+0.5*sin t+0.01*d;
  rgb:(65536*r)+(256*g)+b;

  rect[([]
    p:flip (px;py);
    size:(count px)#enlist (tw;th);
    fill:rgb
  )];
  state
 }
