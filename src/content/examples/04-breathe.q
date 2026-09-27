/ @title Breathing
/ @level moving
/ @blurb draw runs 60 times a second, and time keeps counting.

draw:{
  background 20;
  r:120+50*sin 2*time;         / sin swings between -1 and 1
  ink 255 190 110;
  circle[center;r]
 }
