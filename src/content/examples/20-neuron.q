/ @title A network learns
/ @level big ideas
/ @blurb A tiny neural network learns a circle. Move the mouse to watch it think — every weight is drawn.

/ 300 points, labelled 1 inside a circle
m:300
P:flip (m?1f;m?1f)
Y:"f"$0.06>sum each (P-\:0.5 0.5) xexp 2
X:4*P-0.5

/ 2 inputs → 8 hidden neurons → 1 output
H:8
W1:(2,H)#gauss 2*H
b1:H#0f
W2:0.5*gauss H
b2:0f
sig:{1%1+exp neg x}
tanh:{-1+2*sig 2*x}
fwd:{[x] h:tanh b1+/:x mmu W1; (h;sig b2+h mmu W2)}
train:{
  hy:fwd X; h:hy 0; yh:hy 1;
  d2:(yh-Y)%m;                    / error at the output
  d1:(d2*\:W2)*1-h*h;             / ...pushed back to the hidden layer
  W2-:2*(flip h) mmu d2; b2-:2*sum d2;
  W1-:2*(flip X) mmu d1; b1-:2*sum d1;
 }

/ the network diagram: where each neuron sits
col:{[n;x0] (n#x0;505+(150%n)*(til n)-0.5*n-1)}
ni:col[2;440]; nh:col[H;505]; no:col[1;570]
ii:raze H#'til 2; jj:(2*H)#til H
links:{[a;b;w] pen (?[w>0;255;90];?[w>0;150;170];?[w>0;80;255]); weight 0.5+1.5*abs w; line[a;b]}

g:0.025*grid[40;40]
G:4*(flip g)-0.5
draw:{
  do[3; train[]];
  heatmap[40 cut last fwd G;`ocean];
  ink (80+175*Y;110+0*Y;255-165*Y); pen 255; weight 1;
  circle[600*flip P;4];
  x:4*(mouse%600)-0.5;
  hy:fwd enlist x;
  pen `none; ink 16 16 26 220; rect[415 415;175 175];
  links[ni[;ii];nh[;jj];raze W1];
  links[nh;no;W2];
  pen 255; weight 1;
  ink gray 255*0.5+0.125*x; circle[ni;7];
  ink gray 255*0.5+0.5*first hy 0; circle[nh;6];
  ink gray 255*first hy 1; circle[no;9]
 }
