sum 101b
sum 1 2 3h
sum 1 2 3i
sum 0x0102
sum 1 2e
sum `int$()
sum ()
max 1 2 3h
max `long$()
max 101b
min `float$()
avg 1 2 3
avg `long$()
prd 1 2 3i
sums 1 2 3h
sums 101b
{x,y}': 1 2 3
-': 1 4 9
%': 2 4 8
,': 1 2 3
0 -': 1 4 9
+[1]
-[5]
+/[1 2 3]
t:([]a:3 1 2 1; b:`c`a`b`a); select count i by b from t
0n 1 2f
1 2 0n
1.5 0n
0N 1 2i
2020.01.01 0Nd
"j"$2.5
"j"$-2.5
"j"$1.5
"i"$-0.5
7 mod 0
-7 mod 2
7 mod -2
-7 div 2
7 div 0
0N+1
0N+1i
1i+0N
string 0N
string 1b
string 1.0
string `a`b
10 {x*2}\ 1
{x*x}/[3;2]
(`a;1;"c")
(1 2;`a`b)
(1;(2;`a))
1e10
123456789.0
0.00001
1 2.5 1e10
aj[`s`t;([]s:`a`a;t:1 3);([]s:`a`a;t:0 2;p:10 20)]
`a`b!(1 2;3 4)
([]a:1 2;b:(1 2;3 4))
([]a:1 2;b:("ab";"cd"))
