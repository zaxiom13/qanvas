/ @title A network learns
/ @level big ideas
/ @blurb A tiny neural network learns to split two clouds of points. Watch the boundary move.

/ training data: 200 points, labelled 1 above the diagonal
m:200
X:flip (m?1f;m?1f)
Y:"f"$(X[;0]+X[;1]+0.15*gauss m)>1

/ one hidden layer of 8 neurons
W1:2 8#0.8*gauss 16
b1:8#0f
W2:0.8*gauss 8
b2:0f
sig:{1%1+exp neg x}

fwd:{[x] h:sig b1+/:x mmu W1; (h;sig b2+h mmu W2)}

train:{
  hy:fwd X; h:hy 0; yh:hy 1;
  d2:(yh-Y)*yh*1-yh;             / output error
  d1:(d2*\:W2)*h*1-h;            / pushed back to the hidden layer
  W2::W2-0.05*(flip h) mmu d2; b2::b2-0.05*sum d2;
  W1::W1-0.05*(flip X) mmu d1; b1::b1-0.05*sum d1;
 }

g:0.025*grid[40;40]
draw:{
  do[5; train[]];
  heatmap[40 cut last fwd flip g;`ocean];
  ink (80+175*Y;110+0*Y;255-165*Y); pen 255; weight 1;
  circle[600*flip X;4]
 }
