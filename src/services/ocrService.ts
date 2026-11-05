import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { OCRResult } from '../types';

// Configure pdfjs worker for Vite
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker fallback in ocrService:', e);
}

export type OCRProgressCallback = (status: string, progress: number) => void;

/**
 * Render a single page of a PDF.js document to an offscreen HTMLCanvasElement
 */
export async function renderPdfPageToCanvas(
  pdfDoc: any,
  pageNumber: number,
  scale: number = 1.5
): Promise<HTMLCanvasElement> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return canvas;
}

/**
 * Perform optical character recognition on a multi-page or single-page PDF document
 */
export async function performPdfOcr(
  pdfSource: Blob | ArrayBuffer,
  language: string = 'eng',
  onProgress?: OCRProgressCallback
): Promise<OCRResult> {
  const startTime = performance.now();
  const arrayBuffer = pdfSource instanceof Blob ? await pdfSource.arrayBuffer() : pdfSource;
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

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

    const pageTexts: string[] = [];
    const allLines: string[] = [];
    let totalConfidence = 0;
    let totalWords = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        onProgress(`Rendering & recognizing page ${pageNum} of ${numPages}...`, Math.round(((pageNum - 1) / numPages) * 100));
      }
      const canvas = await renderPdfPageToCanvas(pdfDoc, pageNum, 1.5);
      const ret = await worker.recognize(canvas);

      const pText = ret.data.text.trim();
      if (pText) {
        pageTexts.push(numPages > 1 ? `--- Page ${pageNum} ---\n${pText}` : pText);
        const words = pText.split(/\s+/).filter(Boolean);
        totalWords += words.length;
        totalConfidence += ret.data.confidence || 85;
        if (ret.data.lines) {
          allLines.push(...ret.data.lines.map((l: any) => l.text.trim()).filter(Boolean));
        }
      }
    }

    const duration = Math.round(performance.now() - startTime);
    const avgConfidence = numPages > 0 ? Math.round(totalConfidence / numPages) : 85;

    return {
      text: pageTexts.join('\n\n'),
      confidence: avgConfidence,
      language,
      processingTimeMs: duration,
      wordsCount: totalWords,
      lines: allLines,
    };
  } catch (err: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('OCR failed: Network connection lost while loading OCR worker assets.');
    }
    throw new Error(err?.message || 'PDF Optical Character Recognition failed.');
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

/**
 * Perform optical character recognition on an image file, blob, or scanned PDF
 */
export async function performOcr(
  imageSource: File | Blob | string,
  language: string = 'eng',
  onProgress?: OCRProgressCallback
): Promise<OCRResult> {
  const isPdf = 
    (imageSource instanceof File && (imageSource.type === 'application/pdf' || imageSource.name.toLowerCase().endsWith('.pdf'))) ||
    (imageSource instanceof Blob && imageSource.type === 'application/pdf');

  if (isPdf) {
    return await performPdfOcr(imageSource as Blob, language, onProgress);
  }

  const startTime = performance.now();
  let worker: any = null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('OCR requires an active internet connection to download and initialize Tesseract language models.');
  }

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
  } catch (err: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('OCR failed: Network connection lost while loading OCR worker assets.');
    }
    throw new Error(err?.message || 'Optical Character Recognition processing failed.');
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}
