# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app/test/browser/user-particle-sketch.spec.ts >> runs pasted particle qSQL sketch in the canvas
- Location: app/test/browser/user-particle-sketch.spec.ts:46:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | const sketch = `setup:{
  4  |     / preallocate empty table; rows appended each frame from the mouse
  5  |     \`size\`bg\`particles!(900 640; Color.NIGHT; ([]pos:();v:();life:();hue:()))
  6  |   }
  7  | 
  8  | draw:{[state;frameInfo;input;canvas]
  9  |   p:state\`particles;
  10 |   m:$[null~input\`mouse; 0.5*canvas\`size; input\`mouse];
  11 | 
  12 |   / spawn 8 new particles per frame around the mouse
  13 |   ang:2*acos[-1]*(8?1f);
  14 |   sp:2+8?3f;
  15 |   newp:([]
  16 |     pos:8#enlist m;
  17 |     v:flip (sp*cos ang; (sp*sin ang)-6f);
  18 |     life:8#120;
  19 |     hue:8?360);
  20 |   p:p,newp;
  21 | 
  22 |   / integrate
  23 |   p:update pos:pos+v, v:v+(count v)#enlist (0f;0.18), life:life-1 from p;
  24 |   p:delete from p where life<=0;
  25 |   p:delete from p where (last each pos)>last canvas\`size;
  26 | 
  27 |   / render
  28 |   background[Color.NIGHT];
  29 |   r:2+0.02*p\`life;
  30 |   a:(p\`life)%120f;
  31 |   h:p\`hue;
  32 |   fill:(65536*floor 255*0.5+0.5*sin 0.017*h)
  33 |       +(256*floor 255*0.5+0.5*sin 0.013*h+2)
  34 |       +(floor 255*0.5+0.5*sin 0.019*h+4);
  35 | 
  36 |   circle[([]
  37 |     p:p\`pos;
  38 |     r:r;
  39 |     fill:fill;
  40 |     alpha:a
  41 |   )];
  42 | 
  43 |   \`size\`bg\`particles!(state\`size;state\`bg;p)
  44 |  }`;
  45 | 
  46 | test('runs pasted particle qSQL sketch in the canvas', async ({ page }) => {
  47 |   const errors: string[] = [];
  48 |   page.on('pageerror', (error) => errors.push(error.message));
  49 | 
> 50 |   await page.goto('/');
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  51 |   const editor = page.getByLabel('q sketch editor');
  52 |   await editor.click();
  53 |   await page.keyboard.press('Meta+A');
  54 |   await page.keyboard.type(sketch);
  55 |   await page.getByRole('button', { name: 'Canvas' }).click();
  56 | 
  57 |   await expect(page.locator('.sketch-overlay--error')).toHaveCount(0);
  58 |   await expect(page.locator('.sketch-overlay--running')).toHaveCount(1);
  59 |   expect(errors).toEqual([]);
  60 | });
  61 | 
```