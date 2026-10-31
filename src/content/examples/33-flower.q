/ @title Flower
/ @level first steps
/ @blurb Two stars and a hexagon, stacked and spun. Change the 8s to grow more petals.

draw:{
  background `cream;
  push[];
  move center;
  turn time%3;
  ink `coral; star[0 0;230;8];
  turn neg time%1.5;
  ink `tangerine; star[0 0;150;8];
  ink `lemon; ngon[0 0;75;6];
  pop[];
  ink `ink; circle[center;28]
 }
