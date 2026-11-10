export interface CharRuler {
  measureCharPx: (ch: string) => number;
  measureStrPx: (str: string) => number;
}

// Font-metric estimate (CJK ≈ font size, Latin ≈ 0.55em). RN has no synchronous text measurement,
// so a safety factor over-estimates bold glyphs: wrapping a little early never overflows the bubble.
const estimateCharPx = (ch: string, fontPx: number): number => {
  if (!ch) return 0;
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x80) return fontPx * 0.55;
  if (code < 0x2e80) return fontPx * 0.6;
  return fontPx;
};

export const createCharRuler = (fontPx: number, safety = 1.1): CharRuler => {
  const cache = new Map<string, number>();

  const measureCharPx = (ch: string): number => {
    if (!ch) return 0;
    const hit = cache.get(ch);
    if (hit !== undefined) return hit;
    const w = estimateCharPx(ch, fontPx) * safety;
    cache.set(ch, w);
    return w;
  };

  const measureStrPx = (str: string): number =>
    Array.from(str || '').reduce((sum, ch) => sum + measureCharPx(ch), 0);

  return { measureCharPx, measureStrPx };
};
