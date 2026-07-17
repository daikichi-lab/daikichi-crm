import { describe, it, expect } from 'vitest';
import { grayscaleContrastStretch } from '../../app/scan/preprocess';

function rgba(pixels: Array<[number, number, number]>): Uint8ClampedArray {
  const a = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    a[i * 4] = r;
    a[i * 4 + 1] = g;
    a[i * 4 + 2] = b;
    a[i * 4 + 3] = 255;
  });
  return a;
}

describe('grayscaleContrastStretch', () => {
  it('グレースケール化される（R=G=B、alphaは保持）', () => {
    const d = rgba([[10, 50, 200], [255, 0, 0], [0, 255, 0], [12, 34, 56]]);
    grayscaleContrastStretch(d);
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i + 1]).toBe(d[i + 2]);
      expect(d[i + 3]).toBe(255);
    }
  });

  it('狭いレンジ(100..150)がコントラスト伸長で 0..255 付近まで広がる', () => {
    const px: Array<[number, number, number]> = [];
    for (let v = 100; v <= 150; v++) px.push([v, v, v]);
    const d = rgba(px);
    grayscaleContrastStretch(d);
    const vals: number[] = [];
    for (let i = 0; i < d.length; i += 4) vals.push(d[i]);
    expect(Math.min(...vals)).toBeLessThan(30);
    expect(Math.max(...vals)).toBeGreaterThan(225);
  });

  it('空配列でも例外を投げない', () => {
    expect(() => grayscaleContrastStretch(new Uint8ClampedArray(0))).not.toThrow();
  });
});
