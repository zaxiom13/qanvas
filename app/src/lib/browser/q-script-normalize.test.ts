import { describe, expect, it } from 'vitest';
import { normalizeQScript } from './q-script-normalize';

describe('normalizeQScript', () => {
  it('preserves line comments inside multiline lambdas', () => {
    const source = `setup:{
      / comment must not swallow the setup body
      \`size\`bg!(900 640; Color.NIGHT)
    }

draw:{[state;frameInfo;input;canvas]
  / comment must not swallow the draw body
  background[Color.NIGHT];
  state
}`;

    expect(normalizeQScript(source)).toEqual([
      `setup:{
/ comment must not swallow the setup body
\`size\`bg!(900 640; Color.NIGHT)
}`,
      `draw:{[state;frameInfo;input;canvas]
/ comment must not swallow the draw body
background[Color.NIGHT];
state
}`,
    ]);
  });
});
