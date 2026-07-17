// PaddleOCR（PP-OCR）をブラウザ内で実行し、日本語名刺を高精度に読む。
// @gutenye/ocr-browser（onnxruntime-web）＋日本語モデル。画像は端末外に出さない（C-7）。
// モデルは /public/models: det=ch PP-OCRv4（言語非依存）/ rec=japan PP-OCRv3 / dict=japan。
// 無料（MIT・OSS）・完全端末内（C-1/C-7）。初回はモデル(≈14MB)＋wasmのDLで少し待つ（以後キャッシュ）。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ocrPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOcr(): Promise<any> {
  if (!ocrPromise) {
    ocrPromise = (async () => {
      const ort = await import('onnxruntime-web');
      // wasm を CDN から取得（バンドラのwasm供給問題を回避）。単一スレッド＝SharedArrayBuffer/COOP-COEP不要。
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
      ort.env.wasm.numThreads = 1;
      const Ocr = (await import('@gutenye/ocr-browser')).default;
      return Ocr.create({
        models: {
          detectionPath: '/models/det.onnx',
          recognitionPath: '/models/japan_rec.onnx',
          dictionaryPath: '/models/japan_dict.txt',
        },
      });
    })();
  }
  return ocrPromise;
}

/** File/Blob を PaddleOCR で読み、行テキストを改行連結して返す。失敗時は例外を投げる（呼び出し側でフォールバック）。 */
export async function recognizeWithPaddle(file: Blob): Promise<string> {
  const ocr = await getOcr();
  const url = URL.createObjectURL(file);
  try {
    // detect は画像URLを受け取り Line[] を返す（各行に text）。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines: any[] = await ocr.detect(url, {});
    return (lines || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((l: any) => (typeof l === 'string' ? l : (l?.text ?? l?.txt ?? '')))
      .filter((s: string) => s && s.trim())
      .join('\n');
  } finally {
    URL.revokeObjectURL(url);
  }
}
