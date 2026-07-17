// 名刺画像の前処理（ブラウザ内・端末内で完結。画像は外部OCRサービスに送らない＝C-7）。
// 背景の色地/グラデや低コントラストを抑え、拡大して Tesseract.js の読み取り精度を上げる。
// 画素変換の中核（グレー化＋コントラスト伸長）は DOM 非依存の純関数で、単体テストできる。

/**
 * RGBA 画素配列をグレースケール化し、上下2%を外れ値として無視した min/max で
 * コントラストを伸長する（in place）。背景のハイライト/影に強い。
 * 返り値は使用した下限/上限（テスト・デバッグ用）。
 */
export function grayscaleContrastStretch(data: Uint8ClampedArray): { lo: number; hi: number } {
  const n = (data.length / 4) | 0;
  if (n === 0) return { lo: 0, hi: 255 };
  const gray = new Uint8Array(n);
  const hist = new Array(256).fill(0);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    // Rec.601 輝度
    const g = ((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0) & 0xff;
    gray[p] = g;
    hist[g]++;
  }
  // 上下2%を外れ値として捨てた min/max を伸長基準にする。
  const cut = Math.floor(n * 0.02);
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > cut) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cut) { hi = v; break; } }
  if (hi <= lo) { lo = 0; hi = 255; }
  const scale = 255 / (hi - lo);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    let v = (gray[p] - lo) * scale;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    data[i] = data[i + 1] = data[i + 2] = v; // グレー（alpha はそのまま）
  }
  return { lo, hi };
}

/**
 * 名刺画像 File をブラウザ内で前処理して Blob を返す。
 * - グレースケール化＋コントラスト伸長＋（小さければ）拡大。
 * - DOM/canvas が無い環境や失敗時は元 File をそのまま返す（安全側フォールバック）。
 */
export async function preprocessCardImage(file: Blob): Promise<Blob> {
  try {
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file;
    const bmp = await createImageBitmap(file);
    // 長辺 ~1600px を目安に拡大（小さい写真の文字を読みやすく／上限で速度も担保）。
    const target = 1600;
    const scale = Math.min(2.5, Math.max(1, target / Math.max(bmp.width, bmp.height)));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { bmp.close?.(); return file; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const img = ctx.getImageData(0, 0, w, h);
    grayscaleContrastStretch(img.data);
    ctx.putImageData(img, 0, 0);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
    return blob || file;
  } catch {
    return file;
  }
}
