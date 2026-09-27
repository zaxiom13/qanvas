/ @title Mandelbrot
/ @level big ideas
/ @blurb Complex numbers are points, so a whole grid of them iterates at once.

w:240; h:240
c:(-2.2+2.8*(til[w*h] mod w)%w; -1.4+2.8*(til[w*h] div w)%h)   / one complex number per pixel

z:0*c
k:0*c 0
do[40; z:.cx.add[.cx.sq z;c]; k+:4>.cx.abs2 z]               / every pixel iterates together

heatmap[w cut sqrt k;`magma]
