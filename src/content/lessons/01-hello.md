---
title: Hello, canvas
chapter: First light
blurb: Draw your first shape, and meet the canvas you'll be painting on.
---

Welcome to **Qanvas**. Over these lessons you're going to learn **q** — the array language behind kdb+ — by drawing pictures, animations, little worlds and, eventually, a ray tracer. No installs, no accounts. Just you, a canvas, and a delightfully unusual language.

Let's draw something. Press **Run** on the cell below (or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> inside it).

```q sketch
circle[300 300;100]
```

A circle! Let's unpack that line:

- `circle` is a **function**. Functions take their arguments in square brackets, separated by semicolons: `circle[position;radius]`.
- `300 300` is the **position**: 300 pixels from the left, 300 from the top. Two numbers side by side make a **list** — and a list of two numbers is a point.
- `100` is the **radius**.

The canvas is 600 pixels wide and 600 tall. The top-left corner is `0 0`, and **y grows downward**, like reading a page.

> **Try it:** change `300 300` to `100 150` and run again. Then try a bigger radius.

## Colour and background

Before drawing the circle, let's paint the background and choose an ink:

```q sketch
background 30
circle[300 300;100;`coral]
```

- `background 30` fills everything with a dark gray — 0 is black and 255 is white.
- The optional third argument is the circle's colour. `` `coral `` is a **symbol**: q's way of writing a name. You'll meet lots of them.

Notice that `background 30` has no brackets. When a function takes one argument, you can simply put the argument after it with a space. `background[30]` works too.

## The middle

`center` is a name Qanvas gives you: the middle of the canvas. Run this cell to see its value:

```q
center
```

When you run a plain expression, you see its **value** underneath. Click the little badge beside it to see its *shape*: `center` is a list of two floats.

## Your turn

```q challenge
%% goal Draw one big circle — radius 150 or more — right in the middle, on a black background.
background 30
circle[300 100;50;`lemon]
%% check 1=drawn`circle | Draw exactly one circle.
%% check 0=arg[`background;0] | The background should be black: background 0.
%% check all center=arg[`circle;0] | Put the circle in the middle — use center (or 300 300).
%% check 150<=arg[`circle;1] | Make the radius 150 or more.
%% hint There are three things to change: the background, the position and the radius.
%% hint The position is the first argument of circle; the radius is the second.
%% solution
background 0
circle[center;150;`lemon]
```
