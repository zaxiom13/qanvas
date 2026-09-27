10 20 30
10 20 30*2
1 2 3+10 20 30
til 10
50*til 10
2*3+4
10-2-3
(10-2)-3
2*til 5
count 2*til 5
10+3*til 8
count til 8*3
7%2
5?10
3?1f
p:(200?600f;200?600f);count each p
p:(1 2 3f;10 20 30f);p+100 0
{x*x} 5
sq:{x*x};sq 1 2 3 4
hyp:{sqrt (x*x)+y*y};hyp[3;4]
area:{[w;h] w*h};area[3;5]
area[1 2 3;10]
add:{x+y};add5:add[5];add5 10
minus:{x-y};from100:minus[100;];less100:minus[;100];(from100 30;less100 130)
twice:*[2];twice 1 2 3
3>2
x:4 9 1 7 3;x>5
{$[x>5;`big;`small]} 7
grade:{$[x>=90;`A;x>=70;`B;`C]};grade 95
x:4 9 1 7 3;?[x>5;100;0]
sin 0 0.5 1 1.5 2
x:30 5 80 12 65;x>20
where x>20
x where x>20
p:(10 20 30 40;1 2 3 4);p[;1 3]
sum 30 5 80 12 65>20
x:(1 2 3;4 5;6 7 8 9);count x
count each x
sum each x
max'[x]
{x*x} each 1 2 3
{x,y}'[1 2 3;10 20 30]
+/[1 2 3 4]
(*/) 1 2 3 4 5
{x,y}/[(1 2;3;4 5)]
100+/1 2 3
+\[1 2 3 4]
10 {x*2}/ 1
10 {x*2}\ 1
1 2 3,/:10 20
1 2 3*\:1 10 100
m:(til 5)*\:til 5;m
d:`red`green`blue!255 128 0;d
d`green
d`red`blue
key d
prices:`apple`pear`fig!1.2 0.8 3.5;prices*2
(`a`b!1 2)+`b`c!10 20
count each group "mississippi"
t:([] name:`ada`bo`cy; age:36 24 51; score:88.5 72 95);t
t`age
t 1
flip t
t:([] n:1 2 3 4);update m:n*10 from t
update n:0 from t where n>2
delete from t where n=2
2026.03.14D09:30:00.000000000
2026.03.14D09:30:00.000000000+0D00:05:00
09:30:00+60*til 5
p:(1 2 3f;10 20 60f);avg each p
g:(1 0 0;0 1 0;0 0 1);1 rotate g
1 rotate' g
g:(0 0 0 0;0 1 1 0;0 1 0 0;0 0 0 0);v:(-1 0 1) rotate\: g;nb:sum raze {(-1 0 1) {x rotate' y}\: x} each v;nb
sig:{1%1+exp neg x};sig -5 0 5
X:(0 0f;0 1f;1 0f;1 1f);w:2 -1f;X mmu w
sig:{1%1+exp neg x};tanh:{-1+2*sig 2*x};W1:(2 8)#0.5*til 16;W2:8#0.1;x:enlist 1 -1f;h:tanh x mmu W1;sig h mmu W2
S:([] c:(0 0 3.5;-1.25 -0.35 4.4;1.3 -0.45 3.6;0 -101 4); r:1 0.65 0.55 100; col:(1 0.36 0.3;0.3 0.62 1;1 0.85 0.3;0.92 0.9 0.86));S
hit:{[s] b:sum s[`c]*dir; q:(b*b)-(sum s[`c]*s`c)-s[`r]*s`r; t:b-sqrt q; ?[(q>0)&t>0.001;t;0w]}
blocked:{[s] o:P-s`c; b:sum o*light; q:(b*b)-(sum o*o)-s[`r]*s`r; (q>0)&0.001<(neg b)+sqrt q}
