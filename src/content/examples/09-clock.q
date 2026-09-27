/ @title Clock
/ @level moving
/ @blurb Time is data in q: pull hours, minutes and seconds out of .z.T.

draw:{
  background 18 17 26;
  t:.z.T;
  a:(-0.5*pi)+tau*((`hh$t)%12;(`uu$t)%60;(`ss$t)%60);   / three hand angles
  len:130 190 215;
  pen 255 245 230; weight 12 6 2; ink `none;
  line[center;center+(len*cos a;len*sin a)];            / three hands, one call
  pen `none; ink `coral; circle[center;8];
  ink 255 245 230; circle[center+(250*cos b;250*sin b:tau*til[12]%12);4]
 }
