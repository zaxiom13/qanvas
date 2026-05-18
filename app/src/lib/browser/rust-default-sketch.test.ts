import { beforeEach, describe, expect, it } from 'vitest';
import { installQrustHost, uninstallQrustHost } from './q-rust-host';

const BOOT = [
  '.qv.cmds:enlist 0N',
  '.qv.state:()',
  'Color.INK:855327',
  'Color.CREAM:16051416',
  'Color.BLUE:5992424',
  'background:{[fill].qv.append[`kind`fill!(`background;fill)]}',
  'circle:{[data].qv.append[`kind`data!(`circle;data)]}',
  '.qv.init:{.qv.cmds:enlist 0N;result:setup[];.qv.state:result;.qv.config:result;:result}',
  '.qv.frame:{[frameJson;inputJson;canvasJson].qv.cmds:enlist 0N;state1:draw[.qv.state;frameJson;inputJson;canvasJson];.qv.state:state1;:1_.qv.cmds}',
].join(';\n');

const DEFAULT_SKETCH = `setup:{
  \`size\`bg!(800 600;Color.CREAM)
}

draw:{[state;frameInfo;input;canvas]
  background[Color.CREAM];
  circle[([]
    p:enlist 0.5*canvas\`size;
    r:enlist 44+18*sin 0.05*frameInfo\`frameNum;
    fill:enlist Color.BLUE;
    alpha:enlist 0.92
  )];
  state
}
`;

describe('default studio sketch on rust host', () => {
  beforeEach(() => {
    uninstallQrustHost();
    installQrustHost();
  });

  it('init without throwing', () => {
    const host = (globalThis as typeof globalThis & { __q_rust_host__?: { evaluate: (s: string) => string } })
      .__q_rust_host__;
    host!.evaluate(BOOT);
    host!.evaluate(DEFAULT_SKETCH);
    expect(() => host!.evaluate('.qv.result:.qv.init[]')).not.toThrow();
  });
});
