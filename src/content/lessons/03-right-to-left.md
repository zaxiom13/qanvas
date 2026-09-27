---
title: q reads right to left
chapter: First light
blurb: There's no "times before plus" in q. Everything is evaluated right to left — and it's liberating.
---

A quick quiz. What is `2*3+4`?

```q
2*3+4
```

If you expected 10, you're thinking in school maths, where multiplication binds tighter than addition. q doesn't do that. **q evaluates from right to left**: first `3+4` (that's 7), then `2*7`.

Press **explain** under the result to watch q do it step by step.

It sounds strange at first, but it's wonderfully simple: there are no precedence rules to memorise. Every operator is equal, and the only rule is *right to left*.

```q
10-2-3
```

That's `10-(2-3)`, which is 11. Parentheses work exactly as you'd expect when you need them:

```q
(10-2)-3
```

## Reading q aloud

Read q right to left and it turns into a little story. `2*til 5` reads: *make `til 5`, then double it*.

```q
2*til 5
```

`count 2*til 5` reads: *make `til 5`, double it, then count it*. A function takes everything to its right as its argument:

```q
count 2*til 5
```

## Why it matters when drawing

Say you want radii that start at 10 and grow by 3. `10+3*til 8` is exactly right, because `3*til 8` happens first:

```q
10+3*til 8
```

But `til 8*3` is not "til 8, times 3" — q works out `8*3` first and gives you `til 24`:

```q
count til 8*3
```

> **Heads up:** a space before `/` starts a **comment** in q, so `x /2` is `x` followed by a comment! q divides with `%` instead: `7%2` is `3.5`.

```q
7%2
```

## Your turn

The sketch below should draw 6 circles with radii 10, 20, 30, 40, 50 and 60, but it has a right-to-left bug. Run it, read the error, and fix it.

```q challenge
%% goal Make the six radii 10 20 30 40 50 60.
background 20
ink `coral
circle[(50+100*til 6;300);10*til 6+1]
%% check 10 20 30 40 50 60~"j"$arg[`circle;1] | The radii should be 10 20 30 40 50 60.
%% hint q reads til 6+1 as til 7 — that's seven radii for six circles. You want 1 added to til 6.
%% hint Try 10*1+til 6
%% solution
background 20
ink `coral
circle[(50+100*til 6;300);10*1+til 6]
```
