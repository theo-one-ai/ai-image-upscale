import { useState, useRef, useCallback } from 'react'

export type UpscaleStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'
export type ScaleMode = 2 | 4
export type ModelType = 'general' | 'anime'
export type ExecMode = 'auto' | 'wasm'

export interface UpscaleResult {
  url: string
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  fileName: string
}

export interface UseUpscalerReturn {
  status: UpscaleStatus
  loadProgress: number
  processProgress: number
  processingTile: { cur: number; total: number } | null
  error: string | null
  result: UpscaleResult | null
  execBackend: string
  loadModel: (model: ModelType, exec: ExecMode) => Promise<void>
  upscale: (file: File, scale: ScaleMode, model: ModelType, exec: ExecMode) => Promise<void>
  cancel: () => void
  reset: () => void
}

// Canvas Lanczos fallback upscaler
function upscaleWithCanvas(
  imageData: ImageData,
  scale: number
): ImageData {
  const srcW = imageData.width
  const srcH = imageData.height
  const dstW = Math.round(srcW * scale)
  const dstH = Math.round(srcH * scale)

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = srcW
  srcCanvas.height = srcH
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.putImageData(imageData, 0, 0)

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = dstW
  dstCanvas.height = dstH
  const dstCtx = dstCanvas.getContext('2d')!
  dstCtx.imageSmoothingEnabled = true
  dstCtx.imageSmoothingQuality = 'high'
  dstCtx.drawImage(srcCanvas, 0, 0, dstW, dstH)

  return dstCtx.getImageData(0, 0, dstW, dstH)
}

// Tile-based upscale using canvas (fallback when ONNX unavailable)
async function upscaleImageCanvas(
  file: File,
  scale: ScaleMode,
  onProgress: (p: number) => void,
  onTile: (cur: number, total: number) => void,
): Promise<{ url: string; width: number; height: number; originalWidth: number; originalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const srcW = img.naturalWidth
        const srcH = img.naturalHeight
        const dstW = srcW * scale
        const dstH = srcH * scale

        onProgress(20)

        // Read source
        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = srcW
        srcCanvas.height = srcH
        const srcCtx = srcCanvas.getContext('2d')!
        srcCtx.drawImage(img, 0, 0)

        onProgress(40)

        // Tile processing
        const TILE = 256
        const tilesX = Math.ceil(srcW / TILE)
        const tilesY = Math.ceil(srcH / TILE)
        const totalTiles = tilesX * tilesY

        const dstCanvas = document.createElement('canvas')
        dstCanvas.width = dstW
        dstCanvas.height = dstH
        const dstCtx = dstCanvas.getContext('2d')!

        let processed = 0
        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            const sx = tx * TILE
            const sy = ty * TILE
            const sw = Math.min(TILE, srcW - sx)
            const sh = Math.min(TILE, srcH - sy)

            const tileData = srcCtx.getImageData(sx, sy, sw, sh)
            const upscaled = upscaleWithCanvas(tileData, scale)

            dstCtx.putImageData(upscaled, sx * scale, sy * scale)
            processed++
            onTile(processed, totalTiles)
            onProgress(40 + Math.round(processed / totalTiles * 55))
          }
        }

        URL.revokeObjectURL(url)
        onProgress(100)

        dstCanvas.toBlob((blob) => {
          if (blob) resolve({ url: URL.createObjectURL(blob), width: dstW, height: dstH, originalWidth: srcW, originalHeight: srcH })
          else reject(new Error('Canvas toBlob failed'))
        }, 'image/png')
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
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

  // Try to detect WebGPU/WebGL support
  const detectBackend = useCallback(async (exec: ExecMode): Promise<string> => {
    if (exec === 'wasm') return 'wasm'
    try {
      if ('gpu' in navigator) return 'webgpu'
    } catch {}
    try {
      const canvas = document.createElement('canvas')
      if (canvas.getContext('webgl2')) return 'webgl'
    } catch {}
    return 'wasm'
  }, [])

  const loadModel = useCallback(async (_model: ModelType, exec: ExecMode) => {
    setStatus('loading')
    setLoadProgress(0)
    setError(null)
    try {
      setLoadProgress(30)
      const backend = await detectBackend(exec)
      setExecBackend(backend)
      setLoadProgress(100)
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setExecBackend('Canvas')
      setLoadProgress(100)
      setStatus('ready')
    }
  }, [detectBackend])

  const upscale = useCallback(async (
    file: File,
    scale: ScaleMode,
    _model: ModelType,
    exec: ExecMode,
  ) => {
    setStatus('processing')
    setProcessProgress(0)
    setProcessingTile(null)
    setError(null)
    setResult(null)
    cancelRef.current = false

    try {
      const backend = await detectBackend(exec)
      setExecBackend(backend)

      // Try ONNX if available, fall back to Canvas
      let upscaled: { url: string; width: number; height: number; originalWidth: number; originalHeight: number }

      try {
        // Attempt ONNX upscale
        const { InferenceSession, Tensor } = await import('onnxruntime-web')

        // Set execution providers by priority
        const providers: string[] = backend === 'webgpu'
          ? ['webgpu', 'wasm']
          : backend === 'webgl'
            ? ['webgl', 'wasm']
            : ['wasm']

        setProcessProgress(10)

        // Load image into canvas
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image()
          const u = URL.createObjectURL(file)
          i.onload = () => { res(i); URL.revokeObjectURL(u) }
          i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('load fail')) }
          i.src = u
        })

        const srcW = img.naturalWidth
        const srcH = img.naturalHeight
        const dstW = srcW * scale
        const dstH = srcH * scale

        setProcessProgress(20)

        // Tile processing
        const TILE_SIZE = 128
        const OVERLAP = 8
        const tilesX = Math.ceil(srcW / TILE_SIZE)
        const tilesY = Math.ceil(srcH / TILE_SIZE)
        const totalTiles = tilesX * tilesY

        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = srcW
        srcCanvas.height = srcH
        const srcCtx = srcCanvas.getContext('2d')!
        srcCtx.drawImage(img, 0, 0)

        const dstCanvas = document.createElement('canvas')
        dstCanvas.width = dstW
        dstCanvas.height = dstH
        const dstCtx = dstCanvas.getContext('2d')!

        // Load ONNX model from local public folder
        const modelUrl = '/models/realesrgan-x4.onnx'

        setProcessProgress(25)
        const session = await InferenceSession.create(modelUrl, {
          executionProviders: providers,
          graphOptimizationLevel: 'all',
        })
        setProcessProgress(35)

        let processed = 0
        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            if (cancelRef.current) throw new Error('cancelled')

            const sx = Math.max(0, tx * TILE_SIZE - OVERLAP)
            const sy = Math.max(0, ty * TILE_SIZE - OVERLAP)
            const sw = Math.min(TILE_SIZE + OVERLAP * 2, srcW - sx)
            const sh = Math.min(TILE_SIZE + OVERLAP * 2, srcH - sy)

            const tileData = srcCtx.getImageData(sx, sy, sw, sh)

            // Convert to float32 tensor [1, 3, H, W]
            const float32 = new Float32Array(3 * sh * sw)
            for (let i = 0; i < sh * sw; i++) {
              float32[i] = tileData.data[i * 4] / 255
              float32[sh * sw + i] = tileData.data[i * 4 + 1] / 255
              float32[2 * sh * sw + i] = tileData.data[i * 4 + 2] / 255
            }

            const tensor = new Tensor('float32', float32, [1, 3, sh, sw])
            const output = await session.run({ input: tensor })
            const outData = Object.values(output)[0]
            const outH = outData.dims[2] as number
            const outW = outData.dims[3] as number
            const outArr = outData.data as Float32Array

            // Convert back to ImageData
            const outImgData = new ImageData(outW, outH)
            for (let i = 0; i < outH * outW; i++) {
              outImgData.data[i * 4] = Math.min(255, Math.max(0, outArr[i] * 255))
              outImgData.data[i * 4 + 1] = Math.min(255, Math.max(0, outArr[outH * outW + i] * 255))
              outImgData.data[i * 4 + 2] = Math.min(255, Math.max(0, outArr[2 * outH * outW + i] * 255))
              outImgData.data[i * 4 + 3] = 255
            }

            // Paste to dst (trimming overlap)
            const trimX = (sx > 0 ? OVERLAP : 0) * scale
            const trimY = (sy > 0 ? OVERLAP : 0) * scale
            const pasteCanvas = document.createElement('canvas')
            pasteCanvas.width = outW
            pasteCanvas.height = outH
            const pasteCtx = pasteCanvas.getContext('2d')!
            pasteCtx.putImageData(outImgData, 0, 0)
            dstCtx.drawImage(pasteCanvas, trimX, trimY, outW - trimX, outH - trimY,
              sx * scale, sy * scale, outW - trimX, outH - trimY)

            processed++
            setProcessingTile({ cur: processed, total: totalTiles })
            setProcessProgress(35 + Math.round(processed / totalTiles * 60))
          }
        }

        const blob = await new Promise<Blob>((res, rej) => {
          dstCanvas.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png')
        })
        upscaled = { url: URL.createObjectURL(blob), width: dstW, height: dstH, originalWidth: srcW, originalHeight: srcH }
        setExecBackend(providers[0])

      } catch (onnxErr: unknown) {
        if (onnxErr instanceof Error && onnxErr.message === 'cancelled') {
          setStatus('idle')
          return
        }
        // ONNX failed → Canvas fallback
        console.warn('ONNX failed, using Canvas fallback:', onnxErr)
        setExecBackend('Canvas (Lanczos)')
        setProcessProgress(10)
        upscaled = await upscaleImageCanvas(
          file, scale,
          (p) => setProcessProgress(p),
          (cur, total) => setProcessingTile({ cur, total }),
        )
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '')
      setResult({
        ...upscaled,
        fileName: `${baseName}_${scale}x_upscaled.png`,
      })
      setProcessProgress(100)
      setProcessingTile(null)
      setStatus('done')

    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'cancelled') {
        setStatus('ready')
        return
      }
      console.error(err)
      setError('업스케일 처리에 실패했습니다. 다른 이미지로 시도해보세요.')
      setStatus('error')
    }
  }, [detectBackend])

  const cancel = useCallback(() => { cancelRef.current = true }, [])

  const reset = useCallback(() => {
    if (result) URL.revokeObjectURL(result.url)
    setResult(null)
    setStatus('ready')
    setError(null)
    setProcessProgress(0)
    setProcessingTile(null)
  }, [result])

  return {
    status, loadProgress, processProgress, processingTile,
    error, result, execBackend,
    loadModel, upscale, cancel, reset,
  }
}