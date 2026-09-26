/ a comment line
f:{[a;b]
  c:a+b;   / trailing comment
  c*2
  }
show f[1;2]
g:{
  x+
   1}
show g 5
h:{
  a:1;
  b:2;
  a+b
 }
show h[]
t:([] a:1 2 3;
  b:`x`y`z)
show t
/
block comment
show 999
\
show `after
k:{x
 +1}
show k 1
m:(1 2 3;
   4 5 6)
show m
show count "a/b"
s:"a; b"
show s
show {$[x;
  `yes;
  `no]} 1b
