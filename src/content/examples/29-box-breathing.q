/ @title Box breathing
/ @level first steps
/ @blurb In, hold, out, hold: four seconds each. A calm minute on a busy train.

s:4                                   / seconds for each side of the box
c:(150 150;450 150;450 450;150 450)   / the four corners

draw:{
  background 16 20 28;
  t:(time mod 4*s)%s;                  / 0 to 4: once round the box
  side:floor t; f:t-side;
  p:c[side]+f*c[(side+1) mod 4]-c side;
  ink `none; pen 55 65 85; weight 6; poly flip c;
  pen `none; ink `mint; glow 30; circle[p;16]; glow 0;
  ink 235; font 40; align `center`middle;
  text[center;("breathe in";"hold";"breathe out";"hold") side];
  ink 120; font 22; text[center+0 48;string s-floor s*f]
 }
