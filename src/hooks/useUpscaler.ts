import { useState, useRef, useCallback } from 'react'
import * as ort from 'onnxruntime-web';

ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 8);
ort.env.wasm.proxy = true;

export type UpscaleStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'
export type ScaleMode = 2 | 4
export type ModelType = 'fast' | 'balanced' | 'quality' | 'anime'
export type ExecMode = 'auto' | 'wasm'
export type TileMode = 'turbo' | 'normal' | 'precise'

// 모델별 기본 파일 경로
const MODEL_PATHS: Record<ModelType, string> = {
  fast:     '/models/realesrgan-compact.onnx',
  balanced: '/models/realesrgan-compact.onnx',
  quality:  '/models/realesrgan-x4.onnx',
  anime:    '/models/realesrgan-anime.onnx',
};

// TileMode에 따른 타일 크기 결정
// turbo:   512px 타일 → 타일 수 1/4, 가장 빠름, 경계 부근 품질 약간 저하 가능
// normal:  256px 타일 → 기본 균형
// precise: 128px 타일 → 가장 정확, 가장 느림 (overlap이 상대적으로 촘촘)
export const TILE_SIZES: Record<TileMode, { tileSize: number; overlap: number }> = {
  turbo:   { tileSize: 512, overlap: 32 },
  normal:  { tileSize: 256, overlap: 16 },
  precise: { tileSize: 128, overlap:  8 },
};

// 모델별 권장 TileMode (사용자 미선택 시 기본값으로 표시용)
export const MODEL_DEFAULT_TILE: Record<ModelType, TileMode> = {
  fast:     'turbo',
  balanced: 'normal',
  quality:  'precise',
  anime:    'precise',
};

export interface UpscaleResult {
  url: string; width: number; height: number;
  originalWidth: number; originalHeight: number; fileName: string;
}

export interface UseUpscalerReturn {
  status: UpscaleStatus; loadProgress: number; processProgress: number;
  processingTile: { cur: number; total: number } | null;
  error: string | null; result: UpscaleResult | null; execBackend: string;
  loadModel: (model: ModelType, exec: ExecMode) => Promise<void>;
  upscale: (file: File, scale: ScaleMode, model: ModelType, exec: ExecMode, tileMode: TileMode) => Promise<void>;
  cancel: () => void; reset: () => void;
}

// --- IndexedDB Cache ---
const DB_NAME = 'ModelCacheDB';
const STORE_NAME = 'models';

const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains(STORE_NAME))
      req.result.createObjectStore(STORE_NAME);
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function getModelWithCache(modelUrl: string, onProgress: (p: number) => void): Promise<string> {
  try {
    const db = await openDB();
    const cached = await new Promise<Blob | undefined>((res) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(modelUrl);
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(undefined);
    });
    if (cached) { onProgress(100); return URL.createObjectURL(cached); }

    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error('Network error');
    const contentLength = +(response.headers.get('Content-Length') || 0);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (contentLength) onProgress(Math.round((receivedLength / contentLength) * 100));
    }

    const blob = new Blob(chunks as unknown as BlobPart[]);
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(blob, modelUrl);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Cache fail, direct fetch:', err);
    return modelUrl;
  }
}

export function useUpscaler(): UseUpscalerReturn {
  const [status, setStatus] = useState<UpscaleStatus>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [processProgress, setProcessProgress] = useState(0)
  const [processingTile, setProcessingTile] = useState<{ cur: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UpscaleResult | null>(null)
  const [execBackend, setExecBackend] = useState<string>('Canvas')
  const cancelRef = useRef(false)

  const detectBackend = useCallback(async (exec: ExecMode): Promise<string> => {
    if (exec === 'wasm') return 'wasm'
    try { if ('gpu' in navigator) return 'webgpu' } catch {}
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') ? 'webgl' : 'wasm'
  }, [])

  const loadModel = useCallback(async (model: ModelType, exec: ExecMode) => {
    setStatus('loading'); setLoadProgress(0); setError(null)
    try {
      const backend = await detectBackend(exec)
      setExecBackend(backend)
      await getModelWithCache(MODEL_PATHS[model], (p) => setLoadProgress(p));
      setStatus('ready')
    } catch { setStatus('ready') }
  }, [detectBackend])

  const upscale = useCallback(async (
    file: File,
    scale: ScaleMode,
    model: ModelType,
    exec: ExecMode,
    tileMode: TileMode,   // ← 사용자가 선택한 타일 모드
  ) => {
    setStatus('processing'); setProcessProgress(0); setProcessingTile(null);
    setError(null); setResult(null); cancelRef.current = false;

    try {
      const backend = await detectBackend(exec);
      setExecBackend(backend);

      const modelUrl = await getModelWithCache(MODEL_PATHS[model], (p) => setProcessProgress(p * 0.2));
      setProcessProgress(20);

      // WebGPU는 Add 커널 버그로 제외
      const providers = backend === 'webgl' ? ['webgl', 'wasm'] : ['wasm'];

      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: providers,
        graphOptimizationLevel: 'all',
      });
      setProcessProgress(25);

      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); const u = URL.createObjectURL(file);
        i.onload = () => { res(i); URL.revokeObjectURL(u); }
        i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Load fail')); }
        i.src = u;
      });

      const srcW = img.naturalWidth;  const srcH = img.naturalHeight;
      const dstW = srcW * scale;      const dstH = srcH * scale;

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = srcW; srcCanvas.height = srcH;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
      srcCtx.drawImage(img, 0, 0);

      const dstCanvas = document.createElement('canvas');
      dstCanvas.width = dstW; dstCanvas.height = dstH;
      const dstCtx = dstCanvas.getContext('2d')!;

      // ★ 사용자가 선택한 tileMode로 타일 크기 결정
      const { tileSize: TILE_SIZE, overlap: OVERLAP } = TILE_SIZES[tileMode];

      const tilesX = Math.ceil(srcW / TILE_SIZE);
      const tilesY = Math.ceil(srcH / TILE_SIZE);
      const totalTiles = tilesX * tilesY;

      let processed = 0;
      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          if (cancelRef.current) throw new Error('cancelled');

          // overlap 포함해서 읽기
          const readX = Math.max(0, tx * TILE_SIZE - OVERLAP);
          const readY = Math.max(0, ty * TILE_SIZE - OVERLAP);
          const readW = Math.min(TILE_SIZE + OVERLAP * 2, srcW - readX);
          const readH = Math.min(TILE_SIZE + OVERLAP * 2, srcH - readY);

          const tileData = srcCtx.getImageData(readX, readY, readW, readH);
          const area = readH * readW;
          const float32 = new Float32Array(3 * area);
          for (let i = 0; i < area; i++) {
            float32[i]            = tileData.data[i * 4]     / 255;
            float32[area + i]     = tileData.data[i * 4 + 1] / 255;
            float32[2 * area + i] = tileData.data[i * 4 + 2] / 255;
          }

          const tensor = new ort.Tensor('float32', float32, [1, 3, readH, readW]);
          const output = await session.run({ input: tensor });
          const outData = Object.values(output)[0];
          const [, , outH, outW] = outData.dims as number[];
          const outArr = outData.data as Float32Array;

          const outImgData = new ImageData(outW, outH);
          const outArea = outH * outW;
          for (let i = 0; i < outArea; i++) {
            outImgData.data[i * 4]     = Math.min(255, Math.max(0, outArr[i] * 255));
            outImgData.data[i * 4 + 1] = Math.min(255, Math.max(0, outArr[outArea + i] * 255));
            outImgData.data[i * 4 + 2] = Math.min(255, Math.max(0, outArr[2 * outArea + i] * 255));
            outImgData.data[i * 4 + 3] = 255;
          }

          // overlap 제거하고 정확한 위치에 붙이기
          const tileOrigX = tx * TILE_SIZE;
          const tileOrigY = ty * TILE_SIZE;
          const cropX = (tileOrigX - readX) * scale;
          const cropY = (tileOrigY - readY) * scale;
          const pasteW = Math.min(TILE_SIZE, srcW - tileOrigX) * scale;
          const pasteH = Math.min(TILE_SIZE, srcH - tileOrigY) * scale;

          const pasteCanvas = document.createElement('canvas');
          pasteCanvas.width = outW; pasteCanvas.height = outH;
          pasteCanvas.getContext('2d')!.putImageData(outImgData, 0, 0);

          dstCtx.drawImage(
            pasteCanvas,
            cropX, cropY, pasteW, pasteH,
            tileOrigX * scale, tileOrigY * scale, pasteW, pasteH
          );

          processed++;
          setProcessingTile({ cur: processed, total: totalTiles });
          setProcessProgress(25 + Math.round((processed / totalTiles) * 75));

          if (processed % 10 === 0) await new Promise(r => setTimeout(r, 0));
        }
      }

      const blob = await new Promise<Blob>((res, rej) =>
        dstCanvas.toBlob(b => b ? res(b) : rej(new Error('Blob fail')), 'image/png')
      );

      setResult({
        url: URL.createObjectURL(blob),
        width: dstW, height: dstH,
        originalWidth: srcW, originalHeight: srcH,
        fileName: `${file.name.replace(/\.[^/.]+$/, '')}_${scale}x_upscaled.png`,
      });
      setProcessProgress(100);
      setStatus('done');

    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'cancelled') { setStatus('ready'); return; }
      console.error(err);
      setError('처리에 실패했습니다. 다른 이미지나 모델을 선택해보세요.');
      setStatus('error');
    }
  }, [detectBackend])

  const cancel = useCallback(() => { cancelRef.current = true; }, [])
  const reset = useCallback(() => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null); setStatus('ready'); setError(null);
    setProcessProgress(0); setProcessingTile(null);
  }, [result])

  return { status, loadProgress, processProgress, processingTile, error, result, execBackend, loadModel, upscale, cancel, reset }
}