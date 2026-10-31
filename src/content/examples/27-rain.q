/ @title Rain
/ @level worlds
/ @blurb Three hundred raindrops as two arrays. Tilt or drag sideways for wind; shake or hold to make it pour.

n:300
p:(n?600f;n?600f)
s:6+n?10f                       / each drop's speed

draw:{
  background 14 18 30;
  wind:$[0<abs tilt 0; 8*tilt 0; (mouse[0]-300)%50];
  pour:1+3*1&shake|mousedown;
  p[1]+:s*pour;
  p[0]+:wind;
  gone:where p[1]>600;
  p[1;gone]:(count gone)#-20f;    / drops that land start again at the top
  p[0]:p[0] mod 600;
  pen 150 185 255 150; weight 1.5;
  line[p;p+(2*wind;2*s)]
 }
