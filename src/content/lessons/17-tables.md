---
title: Tables
chapter: Data
blurb: A table is a list of rows and a dictionary of columns. It's the heart of kdb+.
---

kdb+ is famous for tables, and they're refreshingly simple: a table is a set of named columns, all the same length.

```q
t:([] name:`ada`bo`cy; age:36 24 51; score:88.5 72 95)
t
```

Take a column by its name:

```q
t`age
```

Take a row by its number — and a row is a dictionary:

```q
t 1
```

A table is really a dictionary of columns turned on its side. `flip` shows it:

```q
flip t
```

## Drawing from a table

A table is a lovely way to describe a scene: one row per thing, one column per property. `circle` accepts a table directly, reading the columns `p` (position), `r` (radius) and — if present — `ink`:

```q sketch
balls:([] p:(100 200;300 300;500 150;200 480;450 450); r:40 70 30 55 60; ink:`coral`sky`lemon`mint`violet)
background 20
circle balls
```

Each value in the `p` column is one point — a pair.

## Asking questions: select

`select` is q's query language, built right into the language:

```q
balls:([] p:(100 200;300 300;500 150;200 480;450 450); r:40 70 30 55 60; ink:`coral`sky`lemon`mint`violet)
select from balls where r>45
```

```q
select p,r from balls where ink in `sky`mint
```

Draw only what a query finds:

```q sketch
balls:([] p:(100 200;300 300;500 150;200 480;450 450); r:40 70 30 55 60; ink:`coral`sky`lemon`mint`violet)
background 20
circle select from balls where r>45
```

## Your turn

```q challenge
%% goal Make a table dots with 3 rows and the columns p, r and ink, then draw it with circle dots.
dots:([] p:(100 300;300 300); r:20 40)
background 20
circle dots
%% check 98=type dots | dots should be a table: ([] p:…; r:…; ink:…)
%% check `p`r`ink~cols dots | Give dots the columns p, r and ink, in that order.
%% check 3=count dots | dots should have 3 rows.
%% check 3=drawn`circle | Draw the table with circle dots.
%% hint Every column needs 3 values. ink could be `coral`sky`lemon.
%% solution
dots:([] p:(100 300;300 300;500 300); r:20 40 60; ink:`coral`sky`lemon)
background 20
circle dots
```
