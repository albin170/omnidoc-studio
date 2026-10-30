import { createWorker } from 'tesseract.js';
import { OCRResult } from '../types';

export type OCRProgressCallback = (status: string, progress: number) => void;

/**
 * Perform optical character recognition on an image file or blob
 */
export async function performOcr(
  imageSource: File | Blob | string,
  language: string = 'eng',
  onProgress?: OCRProgressCallback
): Promise<OCRResult> {
  const startTime = performance.now();
  let worker: any = null;

  try {
    worker = await createWorker(language, 1, {
      logger: (m) => {
        if (onProgress && m.status) {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress(m.status, pct);
        }
      },
    });

    const ret = await worker.recognize(imageSource);
    const duration = Math.round(performance.now() - startTime);

    const words = ret.data.text.trim().split(/\s+/).filter(Boolean);
    const lines = ret.data.lines ? ret.data.lines.map((l: any) => l.text.trim()) : ret.data.text.split('\n');

    return {
      text: ret.data.text.trim(),
      confidence: Math.round(ret.data.confidence || 85),
      language,
      processingTimeMs: duration,
      wordsCount: words.length,
      lines: lines.filter(Boolean),
    };
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}
