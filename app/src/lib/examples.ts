export type LessonHighlight = {
  caption: string;
  code: string;
};

export type ExampleLesson = {
  teaches: string;
  intro: string;
  highlight?: LessonHighlight;
};

export type ExampleSketch = {
  id: string;
  name: string;
  category: string;
  difficulty: number;
  accent: string;
  description: string;
  code: string;
  lesson?: ExampleLesson;
};

export const EXAMPLES: ExampleSketch[] = [
  {
    id: 'hello-circle',
    name: 'Hello Circle',
    category: 'Basics',
    difficulty: 1,
    accent: '#5B6FE8',
    description: 'Five concentric rings pulse outward from the mouse like a sonar ping on a dark ocean.',
    lesson: {
      teaches: 'One primitive, one loop — how `setup` and `draw` add up to a living sketch.',
      intro: 'Every sketch has two functions. `setup` runs once to build initial state; `draw` runs every frame with fresh `state`, `frameInfo`, `input`, and `canvas`. This one paints five concentric rings around the mouse.',
      highlight: {
        caption: 'Five rings in a single call. `circle[]` takes a table — one row per shape.',
        code: `circle[([]
  p:5#enlist p;
  r:20 40 64 92 124f + 12*sin each 0.07*t+0 10 20 30 40;
  fill:5#enlist Color.BLUE;
  alpha:0.88 0.6 0.38 0.2 0.09
)]`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.INK];
  p:$[null~input\`mouse;0.5*canvas\`size;input\`mouse];
  t:frameInfo\`frameNum;
  circle[([]
    p:5#enlist p;
    r:20 40 64 92 124f + 12*sin each 0.07*t+0 10 20 30 40;
    fill:5#enlist Color.BLUE;
    alpha:0.88 0.6 0.38 0.2 0.09
  )];
  state
}
`,
  },
  {
    id: 'color-grid',
    name: 'Color Grid',
    category: 'Basics',
    difficulty: 1,
    accent: '#C4956E',
    description: 'A tide of colour washes across a grid of tiles — each cell shifts hue every few frames.',
    lesson: {
      teaches: 'Batch drawing — one `rect[]` call paints 300 tiles by shipping a whole table.',
      intro: 'Instead of looping over shapes, hand the primitive a table. `idx` enumerates every tile; column-wise arithmetic places, sizes, and colours all 300 tiles in a single vectorised call.',
      highlight: {
        caption: 'Rows = tiles, columns = properties. This is the q way.',
        code: `rect[([]
  p:flip cell*(idx mod first n;idx div first n);
  s:count[idx]#enlist cell-2;
  fill:clrs;
  alpha:count[idx]#0.9
)]`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.INK];
  n:20 15;
  cell:(canvas\`size)%n;
  idx:til (*/) n;
  palette:(Color.BLUE;Color.GOLD;Color.CORAL;Color.PURPLE;Color.GREEN;Color.YELLOW);
  t:floor 0.03*frameInfo\`frameNum;
  clrs:palette (idx+t) mod count palette;
  rect[([]
    p:flip cell*(idx mod first n;idx div first n);
    s:count[idx]#enlist cell-2;
    fill:clrs;
    alpha:count[idx]#0.9
  )];
  state
}
`,
  },
  {
    id: 'sunset-horizon',
    name: 'Sunset Horizon',
    category: 'Basics',
    difficulty: 1,
    accent: '#E07A52',
    description: 'Forty horizontal bands blend dawn blue into coral while a soft sun disc bobs on the horizon.',
    lesson: {
      teaches: 'Computed colour channels — build an RGB gradient by packing r/g/b into longs.',
      intro: 'Colours in Qanvas are 24-bit longs: `(r<<16) + (g<<8) + b`. Interpolate each channel independently across the bands and you get a smooth gradient without any colour helper library.',
      highlight: {
        caption: 'Each of r, g, b is a full vector before being folded into one `fill` column.',
        code: `r:"j"$255*0.22+0.67*t;
g:"j"$255*0.14+0.36*t;
b:"j"$255*0.42-0.22*t;
bandColors:(65536*r)+(256*g)+b`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  size:canvas\`size;
  n:40;
  bandH:last[size]%n;
  i:"f"$til n;
  t:i%n-1;
  r:"j"$255*0.22+0.67*t;
  g:"j"$255*0.14+0.36*t;
  b:"j"$255*0.42-0.22*t;
  bandColors:(65536*r)+(256*g)+b;
  rect[([]
    p:flip(n#0f;bandH*i);
    s:n#enlist (first size;bandH+1);
    fill:bandColors;
    alpha:n#1f
  )];
  center:0.5*size;
  sun:center + (0f;0.06*last[size]*sin 0.012*frameInfo\`frameNum);
  circle[([]
    p:enlist sun;
    r:enlist 58+4*sin 0.04*frameInfo\`frameNum;
    fill:enlist Color.SOFT_YELLOW;
    alpha:enlist 0.95
  )];
  circle[([]
    p:enlist sun;
    r:enlist 92+8*sin 0.04*frameInfo\`frameNum;
    stroke:enlist Color.SOFT_YELLOW;
    weight:enlist 2f;
    alpha:enlist 0.28
  )];
  state
}
`,
  },
  {
    id: 'line-weave',
    name: 'Line Weave',
    category: 'Primitives',
    difficulty: 1,
    accent: '#5B6FE8',
    description: 'Ten coloured lines snake across the canvas in sinusoidal waves, shifting phase every frame.',
    lesson: {
      teaches: 'The `line[]` primitive — endpoints `p` and `p2` plus stroke/weight/alpha per row.',
      intro: 'Lines need two endpoints. Build a base point array for the left edge, then add a vector offset for `p2` so each strand gets its own wobble without breaking into scalar coordinates.',
      highlight: {
        caption: 'A phase offset per strand turns identical lines into a weave.',
        code: `line[([]
  p:flip(n#0f;last[size]*(1+til n)%(n+1));
  p2:p + flip(n#first size;0.11*last[size]*sin each t+0.7*til n);
  stroke:palette;
  weight:n#3;
  alpha:n#0.7
)]`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.INK];
  t:0.04*frameInfo\`frameNum;
  size:canvas\`size;
  n:10;
  p:flip(n#0f;last[size]*(1+til n)%(n+1));
  palette:(Color.BLUE;Color.SKY;Color.GOLD;Color.CORAL;Color.RED;Color.PURPLE;Color.GREEN;Color.BLUE;Color.SKY;Color.GOLD);
  line[([]
    p:p;
    p2:p + flip(n#first[size];0.11*last[size]*sin each t+0.7*til n);
    stroke:palette;
    weight:n#3;
    alpha:n#0.7
  )];
  state
}
`,
  },
  {
    id: 'text-poster',
    name: 'Text Poster',
    category: 'Primitives',
    difficulty: 1,
    accent: '#C4956E',
    description: 'A typographic card stacks four lines of copy in contrasting colours on a dark ground.',
    lesson: {
      teaches: 'The `text[]` primitive — lay out typographic rows with per-row colour.',
      intro: '`text[]` is structured just like `circle[]` or `rect[]`: one row per string, with its own position, colour, and alpha. Perfect for titles, overlays, and HUDs.',
      highlight: {
        caption: 'Parallel columns: positions, strings, fills. Four lines in one call.',
        code: `text[([]
  p:(4#enlist center) + (0 -90;0 -34;0 26;0 76);
  text:("q language";"data on canvas";"think in tables";"build with q");
  fill:(Color.CREAM;Color.BLUE;Color.GOLD;Color.SKY);
  alpha:4#0.95
)]`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.INK];
  center:0.5*canvas\`size;
  text[([]
    p:(4#enlist center) + (0 -90;0 -34;0 26;0 76);
    text:("q language";"data on canvas";"think in tables";"build with q");
    fill:(Color.CREAM;Color.BLUE;Color.GOLD;Color.SKY);
    alpha:4#0.95
  )];
  state
}
`,
  },
  {
    id: 'image-stamp',
    name: 'Image Stamp',
    category: 'Primitives',
    difficulty: 1,
    accent: '#8C6BC9',
    description: 'An inline SVG badge sits centred on the canvas — the image[] primitive in one focused example.',
    lesson: {
      teaches: 'The `image[]` primitive — stamp a data URI onto the canvas with its own alpha.',
      intro: 'Images are just another row-oriented primitive: `src`, `p`, `s`, and `alpha`. Here the SVG is inlined as a data URI and stashed in state once at `setup`, then reused every frame.',
      highlight: {
        caption: '`src` can be any URL or data URI. Cache it in state, reuse every frame.',
        code: `image[([]
  src:enlist state\`img;
  p:enlist 236 146;
  s:enlist 210 210;
  alpha:enlist 0.98
)]`,
      },
    },
    code: `setup:{
  img:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%231C1030'/%3E%3Ccircle cx='60' cy='44' r='18' fill='%235B6FE8'/%3E%3Ccircle cx='60' cy='60' r='44' fill='none' stroke='%238C6BC9' stroke-width='7'/%3E%3Cpath d='M26 88c10-18 58-18 68 0' stroke='%23C4956E' stroke-width='9' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";
  \`size\`bg\`img!(800 600;Color.INK;img)
}

draw:{[state;frameInfo;input;canvas]
  background[state\`bg];
  image[([]
    src:enlist state\`img;
    p:enlist 236 146;
    s:enlist 210 210;
    alpha:enlist 0.98
  )];
  state
}
`,
  },
  {
    id: 'breathing-ring',
    name: 'Breathing Ring',
    category: 'Motion',
    difficulty: 1,
    accent: '#7C8EF2',
    description: 'Four concentric rings inhale and exhale at offset phases, like neon hula hoops in slow motion.',
    lesson: {
      teaches: 'Phase-shifted animation — `sin each t+phase*til n` gives staggered motion for free.',
      intro: 'Add a phase offset to `t` and each ring breathes a bit later than the one before. The whole sketch is four sine values, four colours, and some alpha.',
      highlight: {
        caption: 'Staggered phases turn identical rings into an ensemble.',
        code: `circle[([]
  p:4#enlist center;
  r:(50 82 118 162f) + 22*sin each t+0.9*til 4;
  stroke:(Color.BLUE;Color.SKY;Color.GOLD;Color.CORAL);
  weight:4#6;
  alpha:0.8 0.6 0.42 0.25
)]`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.INK];
  t:0.05*frameInfo\`frameNum;
  center:0.5*canvas\`size;
  circle[([]
    p:4#enlist center;
    r:(50 82 118 162f) + 22*sin each t+0.9*til 4;
    stroke:(Color.BLUE;Color.SKY;Color.GOLD;Color.CORAL);
    weight:4#6;
    alpha:0.8 0.6 0.42 0.25
  )];
  state
}
`,
  },
  {
    id: 'spiral-galaxy',
    name: 'Spiral Galaxy',
    category: 'Motion',
    difficulty: 2,
    accent: '#8C6BC9',
    description: 'Three hundred points trace an ever-rotating spiral arm, gently breathing with a secondary sine.',
    lesson: {
      teaches: 'Polar coordinates — angles and radii over `til n` produce swirls from pure arithmetic.',
      intro: 'Walk out a spiral by increasing both angle and radius along `til n`. `cos`/`sin` do the Cartesian conversion, and a small secondary sine keeps it breathing.',
      highlight: {
        caption: 'Parametric radii plus rotating phase = spiral.',
        code: `i:"f"$til n;
angs:(0.18*i) + t + 0.25*sin 0.05*i;
radii:4+0.88*i;
p:(n#enlist center) + flip(radii*cos angs;radii*sin angs)`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.NIGHT)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.NIGHT];
  t:0.004*frameInfo\`frameNum;
  n:320;
  i:"f"$til n;
  angs:(0.18*i) + t + 0.25*sin 0.05*i;
  radii:4+0.88*i;
  center:0.5*canvas\`size;
  palette:(Color.BLUE;Color.SKY;Color.GOLD;Color.CORAL;Color.RED;Color.PURPLE);
  clrs:palette (til n) mod count palette;
  circle[([]
    p:(n#enlist center) + flip(radii*cos angs;radii*sin angs);
    r:n#1.8;
    fill:clrs;
    alpha:n#0.82
  )];
  circle[([]
    p:enlist center;
    r:enlist 16+4*sin 0.03*frameInfo\`frameNum;
    fill:enlist Color.SOFT_YELLOW;
    alpha:enlist 0.95
  )];
  state
}
`,
  },
  {
    id: 'lissajous-dots',
    name: 'Lissajous Trail',
    category: 'Motion',
    difficulty: 2,
    accent: '#5B6FE8',
    description: 'Parametric sin waves lace together into a breathing Lissajous curve — pure maths, pure vibe.',
    lesson: {
      teaches: 'Parametric curves — `(sin a·t, sin b·t+phase)` sweeps out elegant ribbons.',
      intro: 'Lissajous curves are the classic parametric pair. Change the frequency ratio or the phase term and the ribbon reshapes itself.',
      highlight: {
        caption: 'A 3:2 frequency ratio with drifting phase makes the ribbon dance.',
        code: `phase:t+0.04*i;
p:flip((first amp)*sin 3*phase;0.7*t+(last amp)*sin 2*phase);
push[]; translate[center]; generic[enlist \`kind\`angle!(\`rotate;0.35*sin 0.6*t)];
circle[([] p:p; r:n#3.4; fill:clrs; alpha:alphas)];
pop[]`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.MIDNIGHT)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.MIDNIGHT];
  n:220;
  t:0.015*frameInfo\`frameNum;
  i:"f"$til n;
  phase:t+0.04*i;
  size:canvas\`size;
  amp:0.34*size;
  center:0.5*size;
  p:flip((first amp)*sin 3*phase;0.7*t+(last amp)*sin 2*phase);
  palette:(Color.BLUE;Color.SKY;Color.GOLD;Color.CORAL;Color.RED;Color.PURPLE);
  clrs:palette (til n) mod count palette;
  alphas:"f"$0.15+0.8*(til n)%n-1;
  push[];
  translate[center];
  generic[enlist \`kind\`angle!(\`rotate;0.35*sin 0.6*t)];
  circle[([]
    p:p;
    r:n#3.4;
    fill:clrs;
    alpha:alphas
  )];
  pop[];
  state
}
`,
  },
  {
    id: 'orbit-dance',
    name: 'Orbit Dance',
    category: 'Motion',
    difficulty: 2,
    accent: '#C4956E',
    description: 'A small solar system: four planets sweep around a shimmering star along their own orbits.',
    lesson: {
      teaches: 'Body tables — keep per-object state in a table and vectorise the draw.',
      intro: 'Once you have more than a handful of objects, the pattern is the same: define them as a table, then every frame derive draw-time columns from it and hand those to the primitive.',
      highlight: {
        caption: 'Per-body data lives in a table; draw-time math stays vectorised.',
        code: `bodies:([]
  radius:75 140 205 275f;
  speed:0.9 0.62 0.44 0.32;
  fill:(Color.BLUE;Color.GOLD;Color.PURPLE;Color.CORAL);
  size:6 8 10 12f
);
ang:bodies[\`speed]*t;
p:(n#enlist center) + flip(bodies[\`radius]*cos ang;bodies[\`radius]*sin ang)`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.NIGHT)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.NIGHT];
  center:0.5*canvas\`size;
  t:0.02*frameInfo\`frameNum;
  bodies:([]
    radius:75 140 205 275f;
    speed:0.9 0.62 0.44 0.32;
    fill:(Color.BLUE;Color.GOLD;Color.PURPLE;Color.CORAL);
    size:6 8 10 12f
  );
  n:count bodies;
  ang:bodies[\`speed]*t;
  p:(n#enlist center) + flip(bodies[\`radius]*cos ang;bodies[\`radius]*sin ang);
  circle[([]
    p:n#enlist center;
    r:bodies\`radius;
    stroke:n#Color.ORBIT;
    weight:n#1f;
    alpha:n#0.55
  )];
  circle[([]
    p:enlist center;
    r:enlist 18+2*sin 0.06*frameInfo\`frameNum;
    fill:enlist Color.YELLOW;
    alpha:enlist 0.95
  )];
  circle[([]
    p:p;
    r:bodies\`size;
    fill:bodies\`fill;
    alpha:n#0.92
  )];
  state
}
`,
  },
  {
    id: 'particle-fountain',
    name: 'Particle Fountain',
    category: 'Motion',
    difficulty: 2,
    accent: '#E07A52',
    description: 'Six arcs of coloured sparks launch upward each frame, arcing through gravity back to earth.',
    lesson: {
      teaches: 'Stateful simulation — emit into a table, integrate with `update`, filter with `select from`.',
      intro: 'A particle system is three lines of q: append new rows for emits, run `update` to integrate positions and velocities, then `select from ... where life>0` to retire dead particles.',
      highlight: {
        caption: 'Emit, integrate, filter. The whole simulation in three table ops.',
        code: `ticks:(state\`ticks),emit;
ticks:update p:p+v,v:v+(count v)#enlist (0f;0.22),life:life-1 from ticks;
ticks:select from ticks where life>0`,
      },
    },
    code: `setup:{
  \`ticks\`bg!(([] p:();v:();life:\`float$());Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  background[state\`bg];
  size:canvas\`size;
  v:((-2.4;-9f);(-1.2;-7.8);(-0.2;-6.6);(0.2;-5.8);(1.2;-5.2);(2.4;-4.6));
  emit:([] p:6#enlist (0.5*size)+(0  -60f); v:v; life:6#90f);
  ticks:(state\`ticks),emit;
  ticks:update p:p+v,v:v+(count v)#enlist (0f;0.22),life:life-1 from ticks;
  ticks:select from ticks where life>0;
  palette:(Color.CORAL;Color.BLUE;Color.GOLD;Color.PURPLE;Color.GREEN;Color.RED);
  clrs:palette (til count ticks) mod count palette;
  circle[([] p:ticks\`p; r:3+0.07*ticks\`life; fill:clrs; alpha:(count ticks)#0.88)];
  \`ticks\`bg!(ticks;state\`bg)
}
`,
  },
  {
    id: 'click-painter',
    name: 'Click Painter',
    category: 'Interaction',
    difficulty: 2,
    accent: '#D1694E',
    description: 'Click to stamp circles that grow and cycle through a six-colour palette — your canvas, your rules.',
    lesson: {
      teaches: 'Pointer input — read `input\\`mouseButtons` and append into a persistent state table.',
      intro: '`input` is the runtime-supplied record with `mouse`, `mouseButtons`, keyboard state, and more. Guard an append with `if[...]` so you only capture on an actual click.',
      highlight: {
        caption: 'Only append when the left button is actually down.',
        code: `if[(input\`mouseButtons)\`left;
  marks,:([] p:enlist input\`mouse; r:enlist 12f+10*count[marks] mod 5)
]`,
      },
    },
    code: `setup:{
  \`marks\`bg!(([] p:();r:\`float$());Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  marks:state\`marks;
  if[(input\`mouseButtons)\`left;
    marks,:([] p:enlist input\`mouse; r:enlist 12f+10*count[marks] mod 5)
  ];
  background[state\`bg];
  palette:(Color.BLUE;Color.CORAL;Color.GOLD;Color.PURPLE;Color.GREEN;Color.RED);
  clrs:palette (til count marks) mod count palette;
  circle[([] p:marks\`p; r:marks\`r; fill:clrs; alpha:(count marks)#0.88)];
  \`marks\`bg!(marks;state\`bg)
}
`,
  },
  {
    id: 'drag-trail',
    name: 'Drag Trail',
    category: 'Interaction',
    difficulty: 2,
    accent: '#8C6BC9',
    description: 'Drag to paint a rainbow ribbon that fades out — each segment cycles through a vivid palette.',
    lesson: {
      teaches: 'Fading particles — a `life` counter trimmed by `select from ... where life>0` each frame.',
      intro: 'Each segment is emitted with a life value and decremented every frame. When `life` hits zero it falls out of the table and stops being drawn.',
      highlight: {
        caption: 'Decrement, filter, done. No manual cleanup needed.',
        code: `trail:update life:life-1 from trail;
trail:select from trail where life>0`,
      },
    },
    code: `setup:{
  \`trail\`bg!(([] p:();life:\`float$());Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  trail:state\`trail;
  if[(input\`mouseButtons)\`left;
    trail,:([] p:enlist input\`mouse; life:enlist 64f)
  ];
  trail:update life:life-1 from trail;
  trail:select from trail where life>0;
  background[state\`bg];
  circle[([] p:trail\`p; r:8+0.2*trail\`life; fill:count[trail]#enlist Color.PURPLE; alpha:count[trail]#0.82)];
  \`trail\`bg!(trail;state\`bg)
}
`,
  },
  {
    id: 'ripple-pool',
    name: 'Ripple Pool',
    category: 'Interaction',
    difficulty: 2,
    accent: '#7CA6FF',
    description: 'Press and hold anywhere on the canvas to drop ripples that expand outward and fade into the blue.',
    lesson: {
      teaches: 'Time-indexed state — stash `frameNum` when an event happens, derive age per frame.',
      intro: 'Instead of a countdown, stamp each click with the frame it happened on. Age is `current frame - t0`, which means any age-driven animation replays from the birth moment.',
      highlight: {
        caption: 'Birth frame → age → any age-driven animation you want.',
        code: `clicks,:([] p:enlist m; t0:enlist frameInfo\`frameNum);
/ ... later ...
age:"f"$frameInfo[\`frameNum]-clicks\`t0`,
      },
    },
    code: `setup:{
  \`clicks\`bg!(([] p:();t0:\`long$());Color.DEEP)
}

draw:{[state;frameInfo;input;canvas]
  clicks:state\`clicks;
  if[(input\`mouseButtons)\`left;
    m:input\`mouse;
    clicks,:([] p:enlist m; t0:enlist frameInfo\`frameNum)
  ];
  clicks:select from clicks where 150>(frameInfo[\`frameNum]-t0);
  background[Color.DEEP];
  n:count clicks;
  if[n>0;
    age:"f"$frameInfo[\`frameNum]-clicks\`t0;
    primary:([]
      p:clicks\`p;
      r:2+1.7*age;
      stroke:n#Color.SKY;
      weight:n#2.4;
      alpha:(1-0.0068*age)|0
    );
    echo:([]
      p:clicks\`p;
      r:2+1.0*age;
      stroke:n#Color.LAVENDER;
      weight:n#1.6;
      alpha:(0.75-0.0055*age)|0
    );
    circle[primary,echo]
  ];
  \`clicks\`bg!(clicks;state\`bg)
}
`,
  },
  {
    id: 'pulse-grid',
    name: 'Pulse Grid',
    category: 'Interaction',
    difficulty: 2,
    accent: '#4E9F92',
    description: 'A sea of dots breathes in concentric rings from wherever the mouse wanders — a living radar screen.',
    lesson: {
      teaches: 'Distance fields — compute `d = sqrt(sum delta*delta)` across every tile to drive radius and alpha.',
      intro: 'A distance field gives every cell a scalar distance to the pointer. Keep each tile offset as a two-number array, then square-and-sum those arrays to get the field without splitting into `dx` and `dy` variables.',
      highlight: {
        caption: 'Distance plus phase equals outward-expanding rings.',
        code: `delta:p - count[idx]#enlist m;
d:sqrt sum each delta*delta;
wave:sin t-0.025*d;
radii:2.5+4.5*1+wave`,
      },
    },
    code: `setup:{
  \`size\`bg!(800 600;Color.INK)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.INK];
  t:0.08*frameInfo\`frameNum;
  n:20 15;
  cell:(canvas\`size)%n;
  idx:til (*/) n;
  p:flip cell*(0.5+idx mod first n;0.5+idx div first n);
  m:$[null~input\`mouse;0.5*canvas\`size;input\`mouse];
  delta:p-count[idx]#enlist m;
  d:sqrt sum each delta*delta;
  wave:sin t-0.025*d;
  radii:2.5+4.5*1+wave;
  alphas:0.2+0.7*(1+wave)%2;
  palette:(Color.BLUE;Color.SKY;Color.GREEN;Color.GOLD);
  clrs:palette (1+"j"$2+2*wave) mod count palette;
  circle[([]
    p:p;
    r:radii;
    fill:clrs;
    alpha:alphas
  )];
  state
}
`,
  },
  {
    id: 'mandelbrot-static',
    name: 'Mandelbrot Static',
    category: 'Generative',
    difficulty: 3,
    accent: '#E07A52',
    description: 'A Mandelbrot field is rasterized once in setup, then held on the canvas with an empty draw loop.',
    lesson: {
      teaches: 'One-shot renders — build an entire frame in `setup`, then let `draw` rest.',
      intro: 'Not every sketch needs animation. Rasterise once during `setup`, stash the pixels on the canvas, and `draw` can return state unchanged. The final stop on the tour.',
      highlight: {
        caption: 'One frame painted in setup; the draw loop just returns state.',
        code: `setup:{
  / ... compute mandelbrot, then ...
  pixel[([] p:p; fill:fill; alpha:count[idx]#1f)];
  \`size\`bg!(600 600;bg)
}

draw:{[state;frameInfo;input;canvas] state }`,
      },
    },
    code: `mandelbrot:{[n]
  255*flip {x<2}(n,n)#.cx.abs each ({y+.cx.mul[x;x]}/)each flip (10,n*n)#(.cx.new/)each {x cross x}{x*4}{x-0.5}{x%count x}til n
};

setup:{
  n:140;
  bg:0x05070B;
  cell:600%n;
  idx:til n*n;
  vals:"j"$raze mandelbrot n;
  fill:vals + 256*vals + 65536*vals;
  p:flip (cell*idx mod n;cell*idx div n);
  background[bg];
  pixel[([]
    p:p;
    fill:fill;
    alpha:count[idx]#1f
  )];
  \`size\`bg!(600 600;bg)
}

draw:{[state;frameInfo;input;canvas]
  state
}
`,
  },
];

export const GUIDED_TOUR_IDS = [
  'hello-circle',
  'color-grid',
  'sunset-horizon',
  'line-weave',
  'text-poster',
  'image-stamp',
  'breathing-ring',
  'spiral-galaxy',
  'lissajous-dots',
  'orbit-dance',
  'particle-fountain',
  'click-painter',
  'drag-trail',
  'ripple-pool',
  'pulse-grid',
  'mandelbrot-static',
];

export function getGuidedTourExamples() {
  return GUIDED_TOUR_IDS
    .map((id) => EXAMPLES.find((example) => example.id === id))
    .filter((example): example is ExampleSketch => Boolean(example));
}

export function getExampleById(id: string) {
  return EXAMPLES.find((example) => example.id === id);
}

export function getTourStep(id: string | null) {
  if (!id) return 0;
  const index = GUIDED_TOUR_IDS.indexOf(id);
  return index < 0 ? 0 : index + 1;
}

export function isTourExample(id: string | null) {
  return Boolean(id) && GUIDED_TOUR_IDS.includes(id as string);
}

export function getNextTourExample(currentId: string | null) {
  if (!currentId) return getExampleById(GUIDED_TOUR_IDS[0]) ?? null;
  const index = GUIDED_TOUR_IDS.indexOf(currentId);
  if (index < 0 || index >= GUIDED_TOUR_IDS.length - 1) return null;
  return getExampleById(GUIDED_TOUR_IDS[index + 1]) ?? null;
}

export function getPreviousTourExample(currentId: string | null) {
  if (!currentId) return null;
  const index = GUIDED_TOUR_IDS.indexOf(currentId);
  if (index <= 0) return null;
  return getExampleById(GUIDED_TOUR_IDS[index - 1]) ?? null;
}
