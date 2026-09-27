---
title: A dash of finance
chapter: Data
blurb: kdb+ grew up on trading floors. Timestamps, buckets and moving averages — drawn.
---

q has real types for time. A **timestamp** is a date and a time, down to the nanosecond:

```q
2026.03.14D09:30:00.000000000
```

Time arithmetic just works. Add a **timespan**:

```q
2026.03.14D09:30:00.000000000+0D00:05:00
```

Underneath, times are numbers — so lists of times are ordinary lists:

```q
09:30:00+60*til 5
```

## A trading day

Let's invent a stock: 390 minutes of trading, with the price taking a random walk.

```q
n:390
t:09:30+til n
px:100+sums 0.1*-1+2*n?2f
tape:([] time:t; price:px)
5#tape
```

`xbar` rounds down into buckets, so `select … by 30 xbar time` groups the minutes into half-hours:

```q
select open:first price, high:max price, low:min price, close:last price by 30 xbar time from tape
```

That's the kind of query kdb+ answers over billions of rows.

## Drawing the chart

Now the fun part — a candlestick chart, straight from a query:

```q sketch
n:390
t:09:30+til n
px:100+sums 0.12*-1+2*n?2f
tape:([] time:t; price:px)
bars:0!select o:first price, h:max price, l:min price, c:last price by 15 xbar time from tape
k:count bars
lo:min bars`l; hi:max bars`h
y:{[v] 560-500*(v-lo)%hi-lo}
x:30+(540%k)*til k
up:bars[`c]>=bars`o
background 250 247 240
pen 60; weight 1.5
line[(x;y bars`h);(x;y bars`l)]
pen `none
ink ?[up;`mint;`coral]
rect[(x-8;y bars[`o]|bars`c);(16;abs (y bars`o)-y bars`c)]
pen `indigo; weight 2; ink `none
path (x;y 4 mavg bars`c)
```

- `0!` un-keys the result, so its columns are easy to reach.
- `?[up;`mint;`coral]` colours each candle by whether it closed higher than it opened.
- `mavg` is a moving average — the indigo line.

## Your turn

```q challenge
%% goal Group the tape into 60-minute bars and draw one circle per bar at its closing price.
n:390
t:09:30+til n
px:100+sums 0.1*-1+2*n?2f
tape:([] time:t; price:px)
bars:0!select c:last price by 30 xbar time from tape
background 20
ink `lemon
circle[(50+80*til count bars;600-4*bars`c);8]
%% check 7=count bars | Use 60-minute buckets: 60 xbar time. 09:30 to 15:59 makes 7 of them.
%% check 7=drawn`circle | Draw one circle per bar.
%% hint Change the bucket size in the xbar.
%% solution
n:390
t:09:30+til n
px:100+sums 0.1*-1+2*n?2f
tape:([] time:t; price:px)
bars:0!select c:last price by 60 xbar time from tape
background 20
ink `lemon
circle[(50+80*til count bars;600-4*bars`c);8]
```
