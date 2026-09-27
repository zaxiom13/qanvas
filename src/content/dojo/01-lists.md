---
title: Lists
chapter: Dojo
blurb: Warm-ups for thinking in whole lists.
---

```q challenge
%% title Dot product
%% level warmup
%% goal Build answer: the dot product of a and b — multiply item by item, then add it all up.
%% show answer
a:1 2 3 4 5
b:2 3 4 5 6
answer:0
%% check 70=answer | The dot product of a and b is 70.
%% hint Multiply the lists with *, then sum.
%% solution
a:1 2 3 4 5
b:2 3 4 5 6
answer:sum a*b
```

```q challenge
%% title Normalize
%% level warmup
%% goal Divide every value in v by the largest one, so the biggest becomes 1.
%% show answer
v:10 30 50 20 40
answer:v
%% check same[answer;0.2 0.6 1 0.4 0.8] | answer should be 0.2 0.6 1 0.4 0.8.
%% hint max v is the largest value; % divides.
%% solution
v:10 30 50 20 40
answer:v%max v
```

```q challenge
%% title Running max
%% level warmup
%% goal Build the running maximum of readings: each position holds the biggest value seen so far.
%% show answer
readings:3 1 5 2 4 8 6 7 9 0
answer:readings
%% check same[answer;3 3 5 5 5 8 8 8 9 9] | Every position should hold the max so far.
%% hint There's a keyword for exactly this — like sums, but for max.
%% solution
readings:3 1 5 2 4 8 6 7 9 0
answer:maxs readings
```

```q challenge
%% title Evens only
%% level warmup
%% goal Keep only the even numbers from nums, in their original order.
%% show answer
nums:7 14 3 8 11 22 5 6 9
answer:nums
%% check same[answer;14 8 22 6] | answer should be 14 8 22 6.
%% hint A number is even when x mod 2 is 0. Then: nums where …
%% solution
nums:7 14 3 8 11 22 5 6 9
answer:nums where 0=nums mod 2
```

```q challenge
%% title String lengths
%% level warmup
%% goal Build the lengths of the words, sorted from longest to shortest.
%% show answer
words:("hello";"world!!";"q";"kdb";"programming")
answer:count words
%% check same[answer;11 7 5 3 1] | answer should be 11 7 5 3 1.
%% hint count each words gives one length per word. desc sorts.
%% solution
words:("hello";"world!!";"q";"kdb";"programming")
answer:desc count each words
```

```q challenge
%% title Peak finder
%% level core
%% goal A peak is a value bigger than both of its neighbours. Find the peaks in signal, sorted from highest to lowest.
%% show answer
signal:3 7 4 8 5 2 9 1 6 3
answer:signal
%% check same[answer;9 8 7 6] | The peaks are 7, 8, 9 and 6 — sorted descending.
%% hint prev signal and next signal line up each value's neighbours.
%% hint (signal>prev signal)&signal>next signal marks the peaks. Nulls at the ends compare false.
%% solution
signal:3 7 4 8 5 2 9 1 6 3
answer:desc signal where (signal>prev signal)&signal>next signal
```

```q challenge
%% title Segment sums
%% level core
%% goal cuts holds the start of each segment of vals. Sum each segment, and sort the sums descending.
%% show answer
vals:4 2 7 1 5 3 8 6 2 9
cuts:0 3 6
answer:sum vals
%% check same[answer;25 13 9] | The three segment sums, sorted descending, are 25 13 9.
%% hint cuts _ vals splits vals at those positions.
%% solution
vals:4 2 7 1 5 3 8 6 2 9
cuts:0 3 6
answer:desc sum each cuts _ vals
```

```q challenge
%% title Top three
%% level core
%% goal Find the positions of the three biggest values in vals, biggest first.
%% show answer
vals:12 5 8 30 3 45 20 99
answer:til 3
%% check same[answer;7 5 3] | The biggest values are at positions 7, 5 and 3.
%% hint idesc gives the positions that would sort vals from biggest to smallest.
%% solution
vals:12 5 8 30 3 45 20 99
answer:3#idesc vals
```

```q challenge
%% title Rank
%% level core
%% goal Give each score its rank: 0 for the lowest, 1 for the next, and so on.
%% show answer
scores:72 45 95 58 83
answer:scores
%% check same[answer;2 0 4 1 3] | Ranks should be 2 0 4 1 3.
%% hint iasc gives the sorting order; applying iasc twice gives each item's rank. (There's also a rank keyword.)
%% solution
scores:72 45 95 58 83
answer:iasc iasc scores
```

```q challenge
%% title Rising edges
%% level core
%% goal Find the positions where temp crosses from 25 or below to above 25.
%% show answer
temp:20 23 28 30 24 22 27 29 25 20 31 26
answer:where temp>25
%% check same[answer;2 6 10] | The rising edges are at 2, 6 and 10.
%% hint temp>25 is a list of booleans. Where does it change from 0 to 1? deltas can tell you.
%% solution
temp:20 23 28 30 24 22 27 29 25 20 31 26
answer:where 1=deltas temp>25
```

```q challenge
%% title Unique in the bag
%% level warmup
%% goal Collect the distinct values from every bag, sorted ascending.
%% show answer
bags:(1 2 3 4;3 4 5 6;5 6 7 8;7 8 9)
answer:first bags
%% check same[answer;1+til 9] | answer should be 1 2 3 4 5 6 7 8 9.
%% hint raze flattens the bags into one list.
%% solution
bags:(1 2 3 4;3 4 5 6;5 6 7 8;7 8 9)
answer:asc distinct raze bags
```

```q challenge
%% title Biggest and smallest move
%% level core
%% goal prices has daily prices. Build answer as two numbers: the biggest daily rise and the biggest daily fall (as a negative number).
%% show answer
prices:100 104 101 108 103 111 107
answer:0 0
%% check same[answer;8 -5] | The biggest rise is 8 and the biggest fall is -5.
%% hint 1_deltas prices gives each day's change.
%% solution
prices:100 104 101 108 103 111 107
d:1_deltas prices
answer:(max d),min d
```
