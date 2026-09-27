/ @title Ten at once
/ @level first steps
/ @blurb til 10 makes ten numbers — so one call draws ten circles.

/ til 10 is 0 1 2 3 4 5 6 7 8 9
x:30+60*til 10

background 20
ink hsb[til[10]%10;0.7;1]      / ten colours, one per circle
circle[(x;300);5+2*til 10]     / (xs;ys): ten x's and one shared y
