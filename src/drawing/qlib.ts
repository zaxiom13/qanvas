// Qanvas helpers written in q. Loaded into every sketch session.
// Points are `x y` or `(xs;ys)`; these helpers work on both shapes.
export const QANVAS_Q = String.raw`
\d .qv
pi:acos -1
tau:2*acos -1
lerp:{[a;b;t] a+t*b-a}
clamp:{[lo;hi;x] lo|hi&x}
remap:{[x;a;b;c;d] c+(d-c)*(x-a)%b-a}
norm:{sqrt sum x*x}
unit:{x%\:norm x}
dist:{sqrt sum d*d:x-y}
dot:{sum x*y}
polar:{[r;a] (r*cos a;r*sin a)}
angle:{atan2[x 1;x 0]}
ring:{[n] (cos a;sin a:tau*til[n]%n)}
grid:{[w;h] (til[w*h] mod w;til[w*h] div w)}
gauss:{[n] sqrt[-2*log 1-n?1f]*cos tau*n?1f}
mix:{[a;b;t] a+t*b-a}
rot:{[a;p] c:cos a;s:sin a;((c*p 0)-s*p 1;(s*p 0)+c*p 1)}
\d .

.cx.new:{[re;im] (re;im)}
.cx.re:{x 0}
.cx.im:{x 1}
.cx.i:0 1f
.cx.one:1 0f
.cx.add:{x+y}
.cx.sub:{x-y}
.cx.mul:{(((x 0)*y 0)-(x 1)*y 1;((x 0)*y 1)+(x 1)*y 0)}
.cx.sq:{(((x 0)*x 0)-(x 1)*x 1;2*(x 0)*x 1)}
.cx.conj:{(x 0;neg x 1)}
.cx.abs:{sqrt sum x*x}
.cx.abs2:{sum x*x}
.cx.arg:{.qv.atan2[x 1;x 0]}
.cx.div:{d:sum y*y;((((x 0)*y 0)+(x 1)*y 1)%d;(((x 1)*y 0)-(x 0)*y 1)%d)}
.cx.exp:{e:exp x 0;(e*cos x 1;e*sin x 1)}
.cx.log:{(log .cx.abs x;.cx.arg x)}
.cx.polar:{[r;a] (r*cos a;r*sin a)}
.cx.pow:{[z;n] .cx.polar[(.cx.abs z) xexp n;n*.cx.arg z]}
.cx.str:{$[0>type x 0;string[x 0],$[0>x 1;"-";"+"],string[abs x 1],"i";.cx.str each flip x]}
`;
