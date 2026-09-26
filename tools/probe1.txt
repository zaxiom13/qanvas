til 10
1 2 3+10
x:3 4#til 12
x
flip x
+/[1 2 3]
{x*x} each 1 2 3
f:{x+y}; f[1;2]
f[1] 5
t:([]a:1 2 3;b:`x`y`z)
t
select a from t where a>1
update c:a*2 from t
exec b from t
select count i by b from t
`a`b!1 2
(`a`b!1 2)`b
1 2 3 ,/: 4 5
til[3] +\: til 3
3#`a
"hello"
reverse "abc"
raze (1 2;3 4)
0N 1 2
1%0
type 1.0
`int$3.7
2020.01.01+til 3
12:00:00.000
x:10;x+:1;x
sums til 5
deltas 1 4 9
1 2 3 in 2 3
distinct 1 1 2
group `a`b`a
asc 3 1 2
count each (1 2;3 4 5)
{$[x>1;`big;`small]} 3
do[3;show 1]
string 123
"i"$"12"
value "1+2"
parse "1+2"
prd 1 2 3 4
3 rotate til 5
2 cut til 6
" " vs "a b c"
ssr["hello";"l";"L"]
enlist 1
`a`b`c?`b
1+`a
(1 2)+1 2 3
x:1 2 3;x[1]:10;x
@[til 5;1 2;+;100]
.[(1 2;3 4);0 1;*;10]
{x+y}/[0;1 2 3]
(+/) 1 2 3
mmu[2 2#1 2 3 4f;2 2#1 0 0 1f]
wavg[1 2;3 4]
xbar[5;til 12]
1 2 3 mod 2
sqrt 16
exp 1
floor 2.5
5?10
atan2[1;1]
t lj ([a:1 2]c:10 20)
meta t
cols t
([k:1 2] v:3 4)
key ([k:1 2] v:3 4)
.z.p
\t sum til 1000000
{x+y+z}[1;;3] 2
fib:{x,sum -2#x}/[10;1 1]
{x*y}\[1 2 3 4]
10 {x*2}\ 1
(`a;1;"c")
1 2 3!4 5 6
aj[`s;([]s:`a`a;t:1 3);([]s:`a`a;t:0 2;p:10 20)]
`s#1 2 3
.Q.n
.z.K
100000#1
f:{[a;b] a+b}; f . 1 2
til 3;
x@1
"abc" like "a*"
0b
101b
0x1f
1e10
3.14159
-7h$3
count til 1000000
