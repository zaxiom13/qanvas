import { beforeEach, describe, expect, it } from 'vitest';
import { installQrustHost, uninstallQrustHost } from './q-rust-host';

const HELLO_CIRCLE = `setup:{
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
}`;

const MINI_BOOT = [
  '.qv.cmds:enlist 0N',
  '.qv.state:()',
  'Color.INK:855327',
  'Color.BLUE:5992424',
  'background:{[fill].qv.append[`kind`fill!(`background;fill)]}',
  'circle:{[data].qv.append[`kind`data!(`circle;data)]}',
  '.qv.init:{.qv.cmds:enlist 0N;result:setup[];.qv.state:result;.qv.config:result;:result}',
  '.qv.frame:{[frameJson;inputJson;canvasJson].qv.cmds:enlist 0N;state1:draw[.qv.state;frameJson;inputJson;canvasJson];.qv.state:state1;:1_.qv.cmds}',
].join(';\n');

describe('q-rust-host', () => {
  beforeEach(() => {
    uninstallQrustHost();
    installQrustHost();
  });

  it('evaluates boot and init through the host bridge', () => {
    const host = (globalThis as typeof globalThis & { __q_rust_host__?: { evaluate: (s: string) => string } })
      .__q_rust_host__;
    expect(host).toBeTruthy();

    host!.evaluate(MINI_BOOT);
    host!.evaluate('setup:{`size`bg!(800 600;0)}');
    const initRaw = host!.evaluate('.qv.result:.qv.init[]');
    const init = JSON.parse(initRaw) as { value: unknown };
    expect(init.value).toBeTruthy();
  });

  it('loads hello-circle after boot', () => {
    const host = (globalThis as typeof globalThis & { __q_rust_host__?: { evaluate: (s: string) => string } })
      .__q_rust_host__;

    expect(() => {
      host!.evaluate(MINI_BOOT);
      host!.evaluate(HELLO_CIRCLE);
      host!.evaluate('.qv.result:.qv.init[]');
    }).not.toThrow();
  });

  it('formats frame literals with enlist for single-key dicts', () => {
    const host = (globalThis as typeof globalThis & { __q_rust_host__?: { toQLiteralJson: (json: string) => string } })
      .__q_rust_host__;
    const literal = host!.toQLiteralJson(JSON.stringify({ mouse: [320, 240] }));
    expect(literal).toBe('enlist `mouse!enlist (320;240)');
  });
});
