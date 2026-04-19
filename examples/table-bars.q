/ Table Bars — the visualization IS a q table.
/
/ Every frame we build a table `t` whose rows become bars. Column operations
/ do the work: no per-bar drawing code, no branching on index.

setup:{`size`bg`n!(800 600; 0x0A0A1F; 64)}

draw:{[state;frameInfo;input;canvas]
  n:state`n;
  w:(first canvas`size)%n;
  ph:0.04*frameInfo`frameNum;

  / build a table of bar geometry from three arrays + broadcasts
  t:([]
    i:til n;
    x:(til n)*w;
    h:200*0.5+0.5*sin ph+(til n)%6;
    hue:(til n)%n
  );

  t:update y:(last canvas`size)-h, fill:(65536*floor 255*hue)+256*floor 180*1-hue from t;

  background[0x0A0A1F];
  rect[([]
    p:flip (t`x;t`y);
    size:flip (w-2;t`h);
    fill:t`fill
  )];
  state
 }
