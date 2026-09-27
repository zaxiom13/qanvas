---
title: Iterators & matrices
chapter: Dojo
blurb: over, scan, each — and lists of lists.
---

```q challenge
%% title Fibonacci
%% level core
%% goal Build the first 10 Fibonacci numbers, starting 1 1.
%% show answer
answer:1 1
%% check same[answer;1 1 2 3 5 8 13 21 34 55] | answer should be 1 1 2 3 5 8 13 21 34 55.
%% hint {x,sum -2#x} appends the sum of the last two. Repeat it 8 times with /.
%% solution
answer:{x,sum -2#x}/[8;1 1]
```

```q challenge
%% title Doubling
%% level warmup
%% goal Starting from 1, double it 7 times and keep every step: 1 2 4 … 128.
%% show answer
answer:1
%% check same[answer;1 2 4 8 16 32 64 128] | answer should be 1 2 4 8 16 32 64 128.
%% hint Scan (\) keeps every step. A number on the left says how many times.
%% solution
answer:{x*2}\[7;1]
```

```q challenge
%% title Growth milestones
%% level core
%% goal growth holds daily multipliers. Find the first days where the running product passes 2, 3 and 4.
%% show answer
growth:1.2 1.15 1.1 1.25 1.05 1.3 1.1 1.2 1.15 1.1
answer:0 0 0
%% check same[answer;5 7 9] | The milestones are crossed on days 5, 7 and 9.
%% hint prds gives the running product. For one threshold: first where cp>2.
%% hint {first where cp>x} each 2 3 4 does all three at once.
%% solution
growth:1.2 1.15 1.1 1.25 1.05 1.3 1.1 1.2 1.15 1.1
cp:prds growth
answer:{first where cp>x} each 2 3 4
```

```q challenge
%% title Row sums
%% level warmup
%% goal m is a matrix. Build the sum of each row, sorted descending.
%% show answer
m:(1 2 3;4 5 6;7 8 9;10 6 8)
answer:sum m
%% check same[answer;24 24 15 6] | answer should be 24 24 15 6.
%% hint sum m adds the rows together — you want sum each.
%% solution
m:(1 2 3;4 5 6;7 8 9;10 6 8)
answer:desc sum each m
```

```q challenge
%% title Ragged max
%% level warmup
%% goal nested is a list of lists of different lengths. Build the max of each, sorted descending.
%% show answer
nested:(3 7 2 8;15 4 9;30 12 25 18 6;42 1;99 50 75)
answer:max nested
%% check same[answer;99 42 30 15 8] | answer should be 99 42 30 15 8.
%% hint max each.
%% solution
nested:(3 7 2 8;15 4 9;30 12 25 18 6;42 1;99 50 75)
answer:desc max each nested
```

```q challenge
%% title Transpose
%% level warmup
%% goal Flip the matrix m on its side, and take row 1 of the result.
%% show answer
m:(1 2 3 4;5 6 7 8;9 10 11 12)
answer:m 1
%% check same[answer;2 6 10] | Row 1 of the flipped matrix is 2 6 10.
%% hint flip m turns rows into columns.
%% solution
m:(1 2 3 4;5 6 7 8;9 10 11 12)
answer:(flip m) 1
```

```q challenge
%% title Chunks
%% level core
%% goal Cut flat into groups of 4, sum each group, and sort the sums descending.
%% show answer
flat:1 2 3 8 5 6 7 8 9 10 11 8
answer:sum flat
%% check same[answer;38 26 14] | answer should be 38 26 14.
%% hint 4 cut flat makes the groups.
%% solution
flat:1 2 3 8 5 6 7 8 9 10 11 8
answer:desc sum each 4 cut flat
```

```q challenge
%% title Identity
%% level core
%% goal Build a 4×4 identity matrix: 1s on the diagonal, 0s everywhere else.
%% show answer
answer:4 4#0
%% check answer~(1 0 0 0;0 1 0 0;0 0 1 0;0 0 0 1) | answer should be the 4×4 identity matrix of longs.
%% hint (til 4)=/:til 4 compares every row index with every column index.
%% hint "j"$ turns booleans into longs.
%% solution
answer:"j"$(til 4)=/:til 4
```

```q challenge
%% title Matrix multiply
%% level core
%% goal Multiply the matrices A and B, and take the first row of the result.
%% show answer
A:(1 2;3 4)
B:(5 6;7 8)
answer:first A*B
%% check same[answer;19 22] | The first row of A mmu B is 19 22.
%% hint * multiplies item by item. Matrix multiplication is mmu.
%% solution
A:(1 2;3 4)
B:(5 6;7 8)
answer:first A mmu B
```

```q challenge
%% title Distances
%% level core
%% goal x, y and z hold coordinates of four points. Build their distances from the origin, sorted descending.
%% show answer
x:1 3 0 2
y:2 4 0 2
z:2 0 5 1
answer:x
%% check same[answer;5 5 3 3] | The distances are 5 5 3 3 when sorted descending.
%% hint The distance is sqrt (x*x)+(y*y)+z*z.
%% solution
x:1 3 0 2
y:2 4 0 2
z:2 0 5 1
answer:desc sqrt (x*x)+(y*y)+z*z
```
