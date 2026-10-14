---
title: Dictionaries
chapter: Dojo
blurb: Keys, lookups, and counting.
---

```q challenge
%% title Look up a name
%% level warmup
%% goal Look dick up in heights. answer is his height.
%% show answer
heights:`tom`dick`harry!1040 59 27
answer:0
%% check answer=59 | dick's height is 59.
%% hint Index the dictionary with a symbol: heights`dick
%% solution
heights:`tom`dick`harry!1040 59 27
answer:heights`dick
```

```q challenge
%% title A missing colour
%% level warmup
%% goal pal has no mud. answer should be the null a missing key returns.
%% show answer
pal:`sky`sea`sand!10 20 30
answer:0
%% check null answer | A key that is not there is a null, the same type as the values.
%% hint Index pal with the symbol mud.
%% solution
pal:`sky`sea`sand!10 20 30
answer:pal`mud
```

```q challenge
%% title Add two price lists
%% level core
%% goal Add a and b by key. A key on only one side stays, and a shared key is summed.
%% show answer
a:`apple`pear!1 2
b:`pear`fig!10 20
answer:()
%% check answer~`apple`pear`fig!1 12 20 | apple stays 1, pear becomes 12, fig is 20.
%% hint + on two dictionaries lines the values up by key, not by position.
%% solution
a:`apple`pear!1 2
b:`pear`fig!10 20
answer:a+b
```

```q challenge
%% title Letter counts
%% level warmup
%% goal Count the letters in word. Each letter is a key, in the order it first appears.
%% show answer
word:"mississippi"
answer:()
%% check answer~"misp"!1 4 4 2 | m once, then i four times, s four times, p twice.
%% hint count each group word
%% solution
word:"mississippi"
answer:count each group word
```
