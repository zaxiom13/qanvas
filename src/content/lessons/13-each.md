---
title: Each, and when you don't need it
chapter: Thinking in arrays
blurb: Most of q works on whole lists by itself. Sometimes you need each.
---

Most things in q already work on every item — `2*x`, `sqrt x`, `x>5`. But some functions look at a list **as a whole**: `count`, `sum`, `max`, `reverse`, …

```q
x:(1 2 3;4 5;6 7 8 9)
count x
```

That's 3: the list has three items, and each item happens to be a list. What if we want the count *of each item*? That's what `each` is for:

```q
count each x
```

```q
sum each x
```

`each` takes a function on its left and applies it to every item on its right. The symbol `'`, written straight after a function, means the same thing:

```q
max'[x]
```

## each with your own functions

```q
{x*x} each 1 2 3
```

That works — but so does `{x*x} 1 2 3`, because `x*x` already handles whole lists. Reach for `each` only when a function wants **one item at a time**.

## Drawing with each

Here's a function that draws one polygon with *n* sides. `each` draws one for every n in a list:

```q sketch
shape:{[n]
  a:(6.28*til[n]%n)-1.57;
  c:(80+150*(n-3) mod 4;150+250*(n-3) div 4);
  ink hsb[n%10;0.6;1];
  poly c+(55*cos a;55*sin a)
 }
background 20
shape each 3+til 8
```

## each with two lists

`'` also pairs two lists item by item:

```q
{x,y}'[1 2 3;10 20 30]
```

## Your turn

```q challenge
%% goal rs holds three lists of radii. Draw one row of circles per list — row i at y = 100+100*i.
rs:(10 20 30;15 15;5 10 15 20 25)
background 20
ink `sky
circle[(50+80*til count rs 0;100);rs 0]
%% check 10=drawn`circle | Draw all 10 circles (3 + 2 + 5).
%% check 3=count drew`circle | Use one circle call per row — each is perfect for this.
%% hint Write row:{[i] …} that draws row i, then call row each til count rs.
%% solution
rs:(10 20 30;15 15;5 10 15 20 25)
row:{[i] circle[(50+80*til count rs i;100+100*i);rs i]}
background 20
ink `sky
row each til count rs
```
