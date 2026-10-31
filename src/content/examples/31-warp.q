/ @title Warp
/ @level arrays
/ @blurb Four hundred stars flying at you, all in three arrays. Tilt or drag to steer.

n:400
s:(-1+n?2f;-1+n?2f;0.05+n?1f)          / x, y and depth of every star

draw:{
  background 2 2 8;
  s[2]-:0.008;                          / everything moves closer
  gone:where s[2]<0.02; k:count gone;
  s[0;gone]:-1+k?2f; s[1;gone]:-1+k?2f; s[2;gone]:k#1f;
  aim:$[0<sum abs tilt; tilt; (mouse-center)%300];
  p:center+300*((s[0]-aim 0);(s[1]-aim 1))%\:s 2;   / perspective: divide by depth
  ink 255; glow 6;
  circle[p;0.4+2.5*1-s 2]
 }
