/ @title Ray tracer
/ @level big ideas
/ @blurb Every pixel's ray, traced in parallel: spheres, light and shadow — pure array code.

/ one ray per pixel, as three rows (xs;ys;zs), all starting at the eye (0 0 0)
w:200; h:200
px:(til[w*h] mod w)%w; py:(til[w*h] div w)%h
dir:unit (px-0.5;0.5-py;(w*h)#1f)

/ the scene: centres, radii and colours, in a table
S:([] c:(0 0 3.5;-1.25 -0.35 4.4;1.3 -0.45 3.6;0 -101 4); r:1 0.65 0.55 100; col:(1 0.36 0.3;0.3 0.62 1;1 0.85 0.3;0.92 0.9 0.86))
light:unit -1 1.4 -0.8

/ how far along each ray we hit sphere s (0w for a miss)
hit:{[s] b:sum s[`c]*dir; q:(b*b)-(sum s[`c]*s`c)-s[`r]*s`r; t:b-sqrt q; ?[(q>0)&t>0.001;t;0w]}
T:hit each S                         / 4 rows of distances, one per sphere
t:min T                              / nearest hit for every pixel
k:sum (til count S)*T=\:t           / ...and which sphere it was
P:dir*\:t                            / the hit points
N:unit P-flip S[`c] k                / surface normals

/ shadows: from each hit point, does any sphere block the light?
blocked:{[s] o:P-s`c; b:sum o*light; q:(b*b)-(sum o*o)-s[`r]*s`r; (q>0)&0.001<(neg b)+sqrt q}
shadow:max blocked each S

lam:0|sum N*light                    / how squarely each point faces the light
shade:0.12+0.88*lam*not shadow
col:(flip S[`col] k)*\:shade
sky:(0.35+0.4*py;0.55+0.35*py;0.95+0.05*py)
img:{?[t<0w;x;y]}'[col;sky]          / sphere colour where we hit, sky elsewhere
pixels w cut/: img
