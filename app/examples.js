/* ================================================================
   QANVAS5 — EXAMPLES LIBRARY
================================================================ */

'use strict';

window.EXAMPLES = [
  {
    id: 'hello-circle',
    name: 'Hello Circle',
    category: 'Basics',
    difficulty: 1,
    accent: '#5B6FE8',
    description: 'A friendly circle follows the mouse and gives the canvas a first pulse of life.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  p:$[null~input\`mouse;0.5*canvas\`size;input\`mouse];
  circle[([]
    p:enlist p;
    r:enlist 42;
    fill:enlist 0x5B6FE8;
    alpha:enlist 0.9
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
    description: 'A position-based color study that turns the canvas into a warm geometric quilt.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  / Build a table of grid cells and derive fill from position
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
    description: 'A single ring expands and contracts with a soft sinusoidal inhale-exhale rhythm.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  / Pulse the radius with sin[frameNum]
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
    description: 'Little sparks launch upward, arc back down, and gather into a lively fountain.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  / Emit particles, add gravity, draw circles with fading alpha
  state
}
`,
  },
  {
    id: 'click-painter',
    name: 'Click Painter',
    category: 'Interaction',
    difficulty: 2,
    accent: '#D1694E',
    description: 'Each click places a persistent circle so the sketch becomes a shared digital sketchbook.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  / Store clicks in state and draw every saved mark
  state
}
`,
  },
  {
    id: 'drag-trail',
    name: 'Drag Trail',
    category: 'Interaction',
    difficulty: 2,
    accent: '#8C6BC9',
    description: 'Drag across the canvas to leave a fading ribbon of circles that slowly disappears.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  / Append drag positions and decay older trail points
  state
}
`,
  },
  {
    id: 'spiral-galaxy',
    name: 'Spiral Galaxy',
    category: 'Generative',
    difficulty: 3,
    accent: '#5C77D9',
    description: 'A rotating spiral of points grows outward into a tiny galaxy of ordered chaos.',
    code: `setup:{
  \`size\`bg!(900 700;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  / Plot logarithmic spiral points with rotating phase
  state
}
`,
  },
  {
    id: 'noise-flow',
    name: 'Noise Flow',
    category: 'Generative',
    difficulty: 3,
    accent: '#4E9F92',
    description: 'Particles drift through a noise field and weave a textured current across the page.',
    code: `setup:{
  \`size\`bg!(900 700;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  / Sample a flow angle from noise and advance particles through the field
  state
}
`,
  },
];
