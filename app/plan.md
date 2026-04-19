# QANVAS5 — COMPLETE SPECIFICATION PRD + TECHNICAL ARCHITECTURE + DESIGN DOCUMENT

---

## 1. PRODUCT OVERVIEW

Qanvas5 is a desktop creative coding environment for the q language.

It allows users to write q code that renders graphics in real time using a table-driven drawing model.

The product is inspired by p5.js but replaces JavaScript with q and focuses on learning columnar thinking through visual experimentation.

**Core philosophy:** learn q by making things move

**Primary goals:**
- Teach q through visual feedback
- Support generative creative coding
- Provide a fast sketching environment
- Keep runtime behavior simple and predictable

---

## 2. TARGET AUDIENCE

**Primary users:**
- Developers learning q
- Data scientists experimenting with q
- Educators teaching q concepts
- Creative coders interested in generative visuals

**Positioning:** A creative playground for learning q

---

## 3. TECHNOLOGY STACK

| Component | Technology |
|---|---|
| Desktop shell | Electron |
| Renderer | p5.js Canvas2D |
| Editor | Monaco Editor |
| Syntax highlighting | Boothroyd q grammar |
| Runtime | q executable provided by kdb-x |
| Communication | JSON over stdin/stdout |
| Font | JetBrains Mono |
| UI mode | Light theme only |

---

## 4. SYSTEM ARCHITECTURE

**Processes:**

**Electron Main Process**
- Application lifecycle
- Project filesystem operations
- Spawning q runtime
- stdin/stdout management
- Menu system

**Electron Renderer Process**
- Monaco editor
- Canvas rendering
- Input capture
- Frame scheduling
- Sidebar UI
- Console display

**Runtime pipeline:**
```
Electron renderer
      ↓
frame payload JSON
      ↓
q runtime
      ↓
q executes draw
      ↓
JSON frame commands emitted
      ↓
renderer executes drawing commands
```

Only one sketch runs at a time.

---

## 5. RUNTIME DEPENDENCY

Qanvas5 requires kdb-x to be installed locally. The application launches the q executable provided by the kdb-x installation. The application does not bundle q.

**Runtime configuration:** global runtime path stored in app settings

**Runtime detection order:**
1. Stored runtime path
2. PATH lookup
3. Environment variables
4. Common installation paths

If detected automatically, the user never sees runtime setup.

If not detected: Run button disabled, setup prompt displayed.

---

## 6. PROJECT STRUCTURE

Projects are folder-based.

```
project/
  sketch.q
  helpers.q
  assets/
```

**Rules:**
- `sketch.q` required
- Helper files contain functions only
- Assets folder stores images and fonts
- Projects contain no runtime configuration

---

## 7. PROGRAM LIFECYCLE

**Required user functions:**
```q
setup:{ ... }
draw:{[state;frameInfo;input;canvas]
    ...
}
```

**Execution flow:**
```
Run pressed → spawn q → load boot.q → load loader.q → execute setup → enter draw loop
```

Each frame: `state:draw[state;frameInfo;input;canvas]`

State lives inside q.

---

## 8. FRAME EXECUTION MODEL

Renderer controls timing via `requestAnimationFrame`.

**Frame order:** input → draw → render

Slow frames simply drop refreshes. No smoothing or frame clamping.

---

## 9. INPUT SYSTEM

Input passed to draw each frame.

**Input table contains:**
- mouse
- mouseButtons
- scroll
- key
- keys

**Example q representation:**
```q
([]
    mouse:();
    mouseButtons:enlist `left`middle`right!0b 0b 0b;
    scroll:enlist 0 0;
    key:enlist "";
    keys:enlist ()
)
```

**Mouse rules:**
- Values update only over canvas
- Leaving canvas sets mouse to null
- Leaving canvas releases pressed buttons
- Scroll events only from canvas

**Keyboard rules:**
- Editor focused → keyboard to editor
- Canvas focused → keyboard to sketch

---

## 10. FRAME INFO

```q
([] frameNum:120; time:2033; dt:16)
```

**Time origin:** when Run is pressed

---

## 11. CANVAS METADATA

```q
([] size:(1200 800); pixelRatio:2f)
```

**Coordinate system:** origin top-left, x increases right, y increases downward

---

## 12. DRAWING PRIMITIVES

**Primitives:** circle, rect, line, text, image, generic

**Transforms:** translate, scale, rotate, push, pop

**Utility commands:** background, canvas, cursor

All primitives append commands to a frame command buffer.

---

## 13. GEOMETRY MODEL

Tables use packed vectors.

**Standard columns:**
- `p` → position (x;y)
- `r` → radius
- `s` → size (width;height)
- `p2` → second point

**Example:**
```q
([] p:(100 200;300 400); r:20 30)
```

---

## 14. STYLE MODEL

Styling is table-driven only.

**Columns:** fill, stroke, weight, alpha

Defaults applied if missing. No global style state.

---

## 15. RENDERING ORDER

- Rows rendered in table order
- Primitives rendered in call order
- `generic` primitive allows mixed ordering

---

## 16. COMMAND BUFFER

Each frame: cmds cleared → draw runs → primitives append commands → JSON frame emitted

Persistent visual effects occur only if the user does not clear the frame.

---

## 17. ERROR HANDLING

Errors are displayed exactly as emitted by q.

**Behavior:**
- Execution stops
- Canvas freezes
- Stopped overlay appears

---

## 18. RESET AND STOP

**Stop:** kill q process, stop frame loop, show stopped overlay

**Reset:** kill q → spawn fresh q → reload sketch → run setup again

---

## 19. EDITOR LAYOUT

```
Toolbar
Sidebar | Code Editor | Canvas
Console
```

- Code editor and canvas share the same row
- Code editor on left
- Console fixed height at bottom
- All panels fixed height with internal scrolling
- Window resizing disabled

---

## 20. FILE MANAGEMENT

Sidebar only.

**Capabilities:**
- Create file
- Rename inline
- Delete file
- Import assets
- Drag-and-drop assets

`sketch.q` cannot be renamed or deleted.

---

## 21. CONSOLE

**Features:**
- Fixed height
- Manual scrolling
- Clear button
- Output filter (All / stdout / stderr)
- Capped buffer

---

## 22. CANVAS CONTROLS

Available controls: Pause, Reset

Stop shows overlay. Optional FPS overlay available.

---

## 23. SAVE MODEL

Manual save only. Shortcut: `Ctrl+S` / `Cmd+S`

Unsaved changes prompt before closing or switching projects.

---

## 24. STARTUP BEHAVIOR

Application opens directly into an empty sketch. No home screen.

**Example startup project:**
```
untitled/
  sketch.q
  assets/
```

Run disabled until runtime configured.

---

## 25. EXPORT

- PNG still frame
- GIF animation (fixed duration)

---

## 26. DISTRIBUTION

Distributed via: GitHub releases, installer packages

Platforms: macOS, Windows, Linux. No auto updates.

---

## 27. LICENSE

MIT License

---

## 28. OPEN SOURCE MODEL

Repository public but maintainer-driven. Forking allowed. Pull requests not expected to be accepted frequently.

---

## 29. DESIGN SYSTEM

**Visual tone:** playful, clean, calm, approachable

Avoid enterprise IDE aesthetic.

---

## 30. COLOR PALETTE

| Element | Color |
|---|---|
| App background | `#FAFAFA` |
| Editor background | `#FFFFFF` |
| Sidebar background | `#F4F4F4` |
| Console background | `#F7F7F7` |
| Borders | `#E5E5E5` |
| Accent | `#4F7FFF` |

---

## 31. CANVAS STYLE

**Default canvas surface:** sepia tone (`#F4ECD8`)

**Purpose:**
- Warm creative feel
- Visually softer than white
- Distinguishes drawing area

---

## 32. TYPOGRAPHY

| Context | Font |
|---|---|
| Code | JetBrains Mono |
| UI | System default |

---

## 33. UI SPACING

| Element | Size |
|---|---|
| Toolbar height | ~40px |
| Sidebar width | ~220px |
| Console height | ~160px |
| Editor padding | ~16px |

---

## 34. INTERACTION STYLE

- Hover effects: subtle background fade
- Animations: short (~150ms)
- Canvas reset: brief flash
- Errors: console highlight

---

## 35. DESIGN PRINCIPLE

The interface should feel like: **VS Code + p5.js + Observable**

Not like: enterprise analytics software

---

## 36. PRODUCT IDENTITY

**Name:** Qanvas5

**Meaning:**
- Q → q language
- anvas → canvas drawing
- 5 → homage to p5.js

**Tagline:** A creative playground for learning q
