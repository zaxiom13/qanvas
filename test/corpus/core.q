// arithmetic & atoms
2+3
2-3
2*3
7%2
7 div 2
-7 div 2
7 mod 3
-7 mod 3
2 xexp 10
2 xlog 8
neg 5
abs -3 4 -5
signum -2 0 3
sqrt 2
exp 0
log 10
floor 3.7 -3.7
ceiling 3.2 -3.2
reciprocal 4
1 2 3*4 5 6
1 2 3+10
10-1 2 3
1+2*3
(1+2)*3
2*3+4
1.5+2
1+1i
1i+1h
1h+1h
1b+1b
0x01+1
3 4 5&4
3 4 5|4
1 2 3=1 5 3
1 2 3<2
1 2 3>2
1 2 3<>2
1 2 3<=2
1 2 3>=2
not 1 0 1b
0.1+0.2
0.3=0.1+0.2
1%0
-1%0
0%0
0w+1
0N=0N
0N<1
0n<0w
null 1 0N 3
1 0N 3^0
0^1 0N 3
5 0N 7^1 2 3
max 3 1 4
min 3 1 4
sum 1 2 3 4
sum 1.5 2.5
avg 1 2 3 4
prd 1 2 3 4
med 3 1 4 1 5
var 1 2 3 4
dev 1 2 3 4
sums 1 2 3 4
prds 1 2 3 4
maxs 3 1 4 1 5
mins 3 1 4 1 5
avgs 1 2 3 4
deltas 1 4 9 16
ratios 1 2 4 8
differ 1 1 2 2 3
count 1 2 3
count `a
count ()
// lists
til 5
til 0
5#1
5#1 2
-3#til 10
3#"abcdef"
2_til 5
-2_til 5
3 4#til 12
0N 3#til 6
2 cut til 7
0 2 5_til 8
reverse 1 2 3
reverse "abc"
first 1 2 3
last 1 2 3
first ()
first `long$()
1 2 3,4 5
1,2
"ab","cd"
`a,`b
1,`a
(1;2),(3;4)
enlist 5
enlist 1 2
raze (1 2;3;4 5)
raze ("ab";"cd")
where 1 0 1 1b
where 2 0 1
distinct 1 1 2 3 3
distinct "hello"
1 2 3?2
1 2 3?5
"hello"?"l"
`a`b`c?`c`a
3 1 4 1 5 in 1 5
"abc" in "bcd"
within[5;1 10]
3 7 12 within 5 10
asc 3 1 4 1 5
desc 3 1 4 1 5
iasc 3 1 4 1 5
idesc 3 1 4 1 5
rank 30 10 20
group 1 2 1 3 2
group "mississippi"
1 2 3 except 2
1 2 3 inter 2 3 4
1 2 3 union 3 4 5
2 rotate 1 2 3 4 5
-1 rotate 1 2 3 4 5
sublist[2;til 10]
sublist[2 3;til 10]
1 2 cross 3 4
(1 2;3 4) cross 5
5 bin 1 3 5 7
1 3 5 7 bin 4
1 3 5 7 bin 0 4 8
prev 1 2 3
next 1 2 3
2 xprev 1 2 3 4
fills 1 0N 0N 4 0N
3 mavg 1 2 3 4 5
3 msum 1 2 3 4 5
3 mmax 1 3 2 5 4
2 xbar 1 2 3 4 5
5 xbar 3 7 12
x:10 20 30 40
x 1
x 1 3
x[1 3]
x 5
x[2]:99
x
x+:1
x
x,:50
x
x[0 1]:1 2
x
@[x;0;neg]
@[x;0 1;+;100]
.[(1 2;3 4);(1;0);:;9]
m:(1 2 3;4 5 6)
m[1]
m[1;2]
m[;1]
m[0 1;2]
flip m
m+1
m*m
sum m
sum each m
// dictionaries
d:`a`b`c!1 2 3
d
d`b
d[`a`c]
key d
value d
d`z
count d
d+10
d,`d`e!4 5
d[`b]:20
d
`a`c#d
`a _ d
d?2
`c`b`a!3 2 1
(`a`b!1 2)+`b`c!10 20
reverse d
asc `c`a`b!3 1 2
where `a`b`c!1 0 1b
// strings
"hello"
count "hello"
upper "hello"
lower "HELLO"
trim "  hi  "
"hello world" like "hello*"
"hello" like "h?llo"
`abc like "a*"
ss["banana";"an"]
ssr["banana";"an";"AN"]
"," vs "a,b,c"
"," sv ("a";"b";"c")
" " vs "the quick brown fox"
string 42
string `abc
string 1 2 3
string 3.14
"i"$"A"
"c"$65
`$"hello"
`$("a";"bc")
"J"$"123"
"F"$"1.5"
"D"$"2020.01.02"
"I"$("1";"22";"x")
`int$3.7
`long$2.5
`float$3
`boolean$0 1 2
`char$97
`date$2020.01.02D12:00:00
`year$2020.05.06
`mm$2020.05.06
`dd$2020.05.06
`hh$12:34:56
`minute$12:34:56
`second$12:34:56.789
`month$2020.05.06
"d"$2020.05m
3$"ab"
-5$"ab"
// temporal
2020.01.01+1
2020.03.01-2020.01.01
2020.01.01 2020.06.15
2020.01.01D00:00:00+0D12:00:00
12:00:00+60
12:00+30
12:00:00.000+1000
2020.01.01+til 3
`date$2020.01.01T12:30:00.000
2020.01.01<2020.01.02
0D01:00:00*2
// lambdas
f:{x*x}
f 5
f[5]
f each 1 2 3
{x+y}[1;2]
{x+y}[1] 2
{x+y+z}[1;;3] 2
g:{[a;b] a-b}
g[10;3]
g[;3] 10
h:{a:x*2; a+1}
h 5
{x}[]
{1+1}[]
{:x*2; 99}[5]
{$[x>0;`pos;x<0;`neg;`zero]} each -1 0 1
{r:0; do[x; r+:1]; r}[5]
{i:0; while[i<x; i+:1]; i}[7]
{if[x>5; :`big]; `small} 3
{if[x>5; :`big]; `small} 9
fac:{$[x<2;1;x*fac x-1]}
fac 10
fib:{$[x<2;x;fib[x-1]+fib x-2]}
fib 15
{x+y}/[1 2 3]
{x,y}/[(1 2;3;4 5)]
{x*y}\[1 2 3 4]
1 {x+y}/ 2 3
(+/) 1 2 3
+/[10;1 2 3]
+\[10;1 2 3]
{x*2}/[3;1]
{x*2}\[3;1]
{x<100}{x*2}/1
{x<100}{x*2}\1
{1+x mod 5}\[3]
(neg;abs) @\: -3
1 2 3 +/: 10 20
1 2 3 +\: 10 20
1 2 3 ,' 4 5 6
{x,y}'[1 2;3 4]
-':[1 4 9 16]
0 -':1 4 9
{x+y}':[1 2 3 4]
count each ("ab";"cde";"f")
{x*x} each til 5
{[x;y] x+y} . 3 4
(+) . 3 4
g . 10 1
f @ 7
@[f;3]
.[g;10 4]
@[{x+1};`a;{`caught}]
@[{x+1};1;{`caught}]
.[{x+y};(1;`a);{"err:",x}]
'[neg;sum] 1 2 3
k:{x+1}
k k k 1
// tables
t:([]name:`alice`bob`carol`dan;age:30 45 28 45;score:88.5 72 95 60.5)
t
count t
cols t
meta t
t 0
t`name
t[1]`age
first t
last t
2#t
-1#t
select from t
select name,age from t
select from t where age>29
select from t where age>29,score>70
select avg score by age from t
select count i by age from t
select n:count i,s:sum score by age from t
select max score from t
select name from t where score=max score
exec name from t
exec name,age from t
exec avg score by age from t
update bonus:score*0.1 from t
update score:0 from t where age=45
update rk:rank score from t
delete from t where age=45
delete score from t
`age xasc t
`score xdesc t
`age`score xasc t
select distinct age from t
flip t
t,([]name:enlist`eve;age:enlist 22;score:enlist 99.0)
kt:([name:`alice`bob]dept:`eng`ops)
kt
kt`bob
key kt
value kt
t lj kt
select name,dept from t lj kt
t ij kt
1!t
0!kt
`name xkey t
xcols[`score`name;t]
`n`a`s xcol t
ungroup ([]a:1 2;b:(3 4;5 6 7))
([]a:1 2 3) uj ([]b:`x`y)
tt:([]a:1 2 3;b:10 20 30)
`tt insert (4;40)
tt
`tt upsert (5;50)
tt
aj[`t;([]t:1 5 9);([]t:0 4 8;v:`a`b`c)]
t[`age]
select from t where name in `bob`dan
select from t where name like "c*"
select name,age,old:age>40 from t
exec count i from t
select sum score, n:count i by old:age>35 from t
count select from t
// types & misc
type 1
type 1 2
type `a
type "a"
type "ab"
type 1.0
type ()
type t
type d
type {x}
type +
type 2020.01.01
key 5
value "2+3"
value `d
parse "1+2"
eval parse "2*3"
`s#1 2 3
attr asc 3 1 2
x:5
x
.z.K>=4
{x+1}
{[a;b] a+b}
(1;`a;"b";2.5)
(1 2;3 4)
((1;2);3)
()
enlist ()
0N
0n
0Ni
0Nd
-0W
0Wi
0w
1e100
1.23456789
12345678.9
0.000123
1.0e-10
100000000
-5
1 -2 3
x:1 -2 3
2 -1
a:3;b:4;a*b
{x-1} -1
- 1 2 3
-1 2 3
1 - 2
1-2
1 -2
// errors
1+`a
(1 2)+1 2 3
undefinedthing
`a+1
{x+y}[1;2;3]
"a"+1
til `a
1 2 3@`a
x:1 2 3; x[0]:`a
'`custom
'"message"
{'`inner}[]
