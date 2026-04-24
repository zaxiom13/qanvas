/ Table Bars — the visualization IS a q table.
/
/ Every frame we build a table `t` whose rows become bars. Column operations
/ do the work: no per-bar drawing code, no branching on index, and geometry
/ stays in pair arrays instead of split x/y scalars.

setup:{`size`bg`n!(800 600; Color.INK; 64)}

draw:{[state;frameInfo;input;canvas]
  n:state`n;
  w:(first canvas`size)%n;
  ph:0.04*frameInfo`frameNum;

  / build a table of bar geometry from arrays + broadcasts
  t:([]
    i:til n;
    h:200*0.5+0.5*sin ph+(til n)%6;
    hue:(til n)%n
  );

  t:update p:flip(w*i;(last canvas`size)-h), fill:(65536*floor 255*hue)+256*floor 180*1-hue from t;

  background[Color.INK];
  rect[([]
    p:t`p;
    size:flip (w-2;t`h);
    fill:t`fill
  )];
  state
 }
