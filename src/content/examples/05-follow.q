/ @title Follow me
/ @level moving
/ @blurb A trail of points, each easing toward the one ahead of it.

n:40
trail:(n#300f;n#300f)          / rows (xs;ys): 40 points, all at the centre

draw:{
  background 18 16 28;
  ahead:(mouse[0],-1_trail 0;mouse[1],-1_trail 1);   / each point's target
  trail+:0.35*ahead-trail;                          / move a third of the way there
  ink hsb[til[n]%n;0.55;1];
  circle[trail;24*1-til[n]%n]
 }
