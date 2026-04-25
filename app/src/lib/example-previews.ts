function preview(markup: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}

export const examplePreviewSrc: Record<string, string> = {
  'hello-circle': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><g fill="none" stroke="#5B6FE8" stroke-width="4" opacity=".95"><circle cx="86" cy="74" r="18"/><circle cx="86" cy="74" r="34" opacity=".7"/><circle cx="86" cy="74" r="52" opacity=".45"/><circle cx="86" cy="74" r="70" opacity=".22"/></g>
</svg>`),
  'color-grid': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><g>${Array.from({ length: 10 }, (_, x) => Array.from({ length: 10 }, (_, y) => `<rect x="${x * 16 + 1}" y="${y * 16 + 1}" width="14" height="14" rx="2" fill="${['#5B6FE8', '#C4956E', '#E07A52', '#8C6BC9', '#4E9F92'][(x + y) % 5]}" opacity=".9"/>`).join('')).join('')}</g>
</svg>`),
  'sunset-horizon': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#25386f"/><stop offset=".55" stop-color="#E07A52"/><stop offset="1" stop-color="#f4c27a"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><circle cx="80" cy="88" r="31" fill="#F7D56E"/><rect y="94" width="160" height="66" fill="#171613" opacity=".9"/><path d="M0 104h160M0 119h160M0 134h160" stroke="#C4956E" opacity=".45"/>
</svg>`),
  'line-weave': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><g fill="none" stroke-linecap="round" stroke-width="4">${['#5B6FE8', '#7CA6FF', '#C4956E', '#E07A52', '#8C6BC9', '#4E9F92'].map((c, i) => `<path d="M10 ${30 + i * 18} C50 ${5 + i * 14} 90 ${85 + i * 5} 150 ${34 + i * 16}" stroke="${c}" opacity=".82"/>`).join('')}</g>
</svg>`),
  'text-poster': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><text x="80" y="48" text-anchor="middle" font-family="monospace" font-size="18" font-weight="700" fill="#f4ecd8">q language</text><text x="80" y="75" text-anchor="middle" font-family="monospace" font-size="14" fill="#5B6FE8">data on canvas</text><text x="80" y="101" text-anchor="middle" font-family="monospace" font-size="14" fill="#C4956E">think in tables</text><text x="80" y="126" text-anchor="middle" font-family="monospace" font-size="14" fill="#7CA6FF">build with q</text>
</svg>`),
  'image-stamp': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><circle cx="80" cy="80" r="56" fill="#1C1030"/><circle cx="80" cy="61" r="20" fill="#5B6FE8"/><circle cx="80" cy="80" r="45" fill="none" stroke="#8C6BC9" stroke-width="8"/><path d="M45 116c14-23 56-23 70 0" stroke="#C4956E" stroke-width="10" stroke-linecap="round" fill="none"/>
</svg>`),
  'breathing-ring': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><g fill="none" stroke-width="7"><circle cx="80" cy="80" r="29" stroke="#5B6FE8"/><circle cx="80" cy="80" r="46" stroke="#7CA6FF" opacity=".75"/><circle cx="80" cy="80" r="64" stroke="#C4956E" opacity=".55"/><circle cx="80" cy="80" r="76" stroke="#E07A52" opacity=".3"/></g>
</svg>`),
  'spiral-galaxy': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#05070B"/><g>${Array.from({ length: 90 }, (_, i) => { const a = i * .42; const r = 4 + i * .78; const x = 80 + Math.cos(a) * r; const y = 80 + Math.sin(a) * r; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${['#5B6FE8', '#7CA6FF', '#C4956E', '#E07A52', '#8C6BC9'][i % 5]}" opacity=".85"/>`; }).join('')}</g><circle cx="80" cy="80" r="9" fill="#F7D56E"/>
</svg>`),
  'lissajous-dots': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#0B1020"/><g>${Array.from({ length: 80 }, (_, i) => { const t = i / 79 * Math.PI * 2; const x = 80 + Math.sin(3 * t) * 55; const y = 80 + Math.sin(2 * t + .8) * 42; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${['#5B6FE8', '#7CA6FF', '#C4956E', '#E07A52', '#8C6BC9'][i % 5]}" opacity="${(.25 + i / 100).toFixed(2)}"/>`; }).join('')}</g>
</svg>`),
  'orbit-dance': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#05070B"/><g fill="none" stroke="#435069" opacity=".65"><circle cx="80" cy="80" r="25"/><circle cx="80" cy="80" r="43"/><circle cx="80" cy="80" r="62"/><circle cx="80" cy="80" r="76"/></g><circle cx="80" cy="80" r="12" fill="#F7D56E"/><circle cx="103" cy="71" r="5" fill="#5B6FE8"/><circle cx="52" cy="113" r="7" fill="#C4956E"/><circle cx="137" cy="83" r="8" fill="#8C6BC9"/><circle cx="64" cy="9" r="6" fill="#E07A52"/>
</svg>`),
  'particle-fountain': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><g>${Array.from({ length: 42 }, (_, i) => { const lane = i % 6 - 2.5; const step = Math.floor(i / 6); const x = 80 + lane * 10 + step * lane * 2; const y = 136 - step * 17 + step * step * 2.3; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(5 - step * .35).toFixed(1)}" fill="${['#E07A52', '#5B6FE8', '#C4956E', '#8C6BC9', '#4E9F92', '#D1694E'][i % 6]}" opacity=".86"/>`; }).join('')}</g>
</svg>`),
  'click-painter': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><circle cx="38" cy="50" r="18" fill="#5B6FE8" opacity=".88"/><circle cx="88" cy="46" r="26" fill="#E07A52" opacity=".78"/><circle cx="124" cy="92" r="20" fill="#C4956E" opacity=".86"/><circle cx="61" cy="111" r="31" fill="#8C6BC9" opacity=".7"/><circle cx="104" cy="128" r="14" fill="#4E9F92" opacity=".9"/>
</svg>`),
  'drag-trail': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><path d="M20 122 C44 48 72 142 103 62 S140 34 146 105" fill="none" stroke="#8C6BC9" stroke-width="20" stroke-linecap="round" opacity=".24"/><g>${Array.from({ length: 28 }, (_, i) => { const t = i / 27; const x = 20 + 130 * t; const y = 88 + Math.sin(t * Math.PI * 4) * 36; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(12 - t * 6).toFixed(1)}" fill="#8C6BC9" opacity="${(.85 - t * .45).toFixed(2)}"/>`; }).join('')}</g>
</svg>`),
  'ripple-pool': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#071E34"/><g fill="none" stroke-width="3"><circle cx="48" cy="62" r="16" stroke="#7CA6FF" opacity=".9"/><circle cx="48" cy="62" r="32" stroke="#B8C5FF" opacity=".45"/><circle cx="105" cy="104" r="20" stroke="#7CA6FF" opacity=".78"/><circle cx="105" cy="104" r="42" stroke="#B8C5FF" opacity=".3"/></g>
</svg>`),
  'pulse-grid': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#171613"/><g>${Array.from({ length: 12 }, (_, x) => Array.from({ length: 10 }, (_, y) => { const dx = x - 6; const dy = y - 5; const d = Math.sqrt(dx * dx + dy * dy); const r = 2 + 4 * (1 + Math.sin(d * 1.4)) / 2; return `<circle cx="${14 + x * 12}" cy="${20 + y * 12}" r="${r.toFixed(1)}" fill="${['#5B6FE8', '#7CA6FF', '#4E9F92', '#C4956E'][Math.floor(d) % 4]}" opacity=".82"/>`; }).join('')).join('')}</g>
</svg>`),
  'mandelbrot-static': preview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#05070B"/><g>${Array.from({ length: 32 }, (_, x) => Array.from({ length: 32 }, (_, y) => { const dx = (x - 16) / 12; const dy = (y - 16) / 12; const v = Math.max(0, 1 - Math.abs(dx * dx - dy * dy * .7 + dx * .35)); const c = Math.round(38 + 190 * v); return `<rect x="${x * 5}" y="${y * 5}" width="5" height="5" fill="rgb(${c},${Math.round(c * .62)},${Math.round(c * .34)})" opacity="${v > .25 ? .95 : .25}"/>`; }).join('')).join('')}</g>
</svg>`),
};
