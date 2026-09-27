/ @title Colour wheel
/ @level first steps
/ @blurb hsb turns a list of hues into a list of colours.

n:72
a:tau*til[n]%n                 / 72 angles around the circle
background 16
ink hsb[til[n]%n;0.8;1]
circle[center+(220*cos a;220*sin a);18]
ink hsb[til[n]%n;0.5;1]
circle[center+(150*cos a;150*sin a);12]
