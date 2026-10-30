import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFAnnotation } from '../types';

// Configure pdfjs worker for Vite
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker fallback initialized:', e);
}

export interface PDFPageInfo {
  pageNumber: number;
  rotation: number;
  width: number;
  height: number;
}

/**
 * Load a PDF document for rendering via PDF.js
 */
export async function loadPdfForViewing(data: ArrayBuffer | Uint8Array) {
  const loadingTask = pdfjsLib.getDocument({ data });
  return await loadingTask.promise;
}

/**
 * Render a single PDF page onto an HTML canvas element
 */
export async function renderPdfPageToCanvas(
  pdfJsDoc: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
): Promise<void> {
  const page = await pdfJsDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const renderContext: any = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };
  
  await page.render(renderContext).promise;
}

/**
 * Extract all selectable text from a PDF document
 */
export async function extractTextFromPdf(pdfBytes: ArrayBuffer): Promise<string> {
  const pdfJsDoc = await loadPdfForViewing(pdfBytes);
  const numPages = pdfJsDoc.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += `--- Page ${i} ---\n` + pageText + '\n\n';
  }

  return fullText.trim();
}

/**
 * Render all pages of a PDF to image blobs (PNG)
 */
export async function renderPdfPagesToImages(pdfBytes: ArrayBuffer, format: 'png' | 'jpeg' = 'png'): Promise<Blob[]> {
  const pdfJsDoc = await loadPdfForViewing(pdfBytes);
  const numPages = pdfJsDoc.numPages;
  const imageBlobs: Blob[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High-DPI render
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob([])), `image/${format}`, 0.95);
    });
    imageBlobs.push(blob);
  }

  return imageBlobs;
}

/**
 * Merge multiple PDF files into a single PDF
 */
export async function mergePdfFiles(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const donorPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(donorPdf, donorPdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

/**
 * Split a PDF and extract a page range (1-indexed inclusive)
 */
export async function splitPdfByRange(
  pdfBuffer: ArrayBuffer,
  startPage: number,
  endPage: number
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcPdf.getPageCount();
  const validStart = Math.max(1, startPage);
  const validEnd = Math.min(totalPages, endPage);

  const subPdf = await PDFDocument.create();
  const pageIndices: number[] = [];
  for (let i = validStart - 1; i <= validEnd - 1; i++) {
    pageIndices.push(i);
  }

  const copiedPages = await subPdf.copyPages(srcPdf, pageIndices);
  copiedPages.forEach((page) => subPdf.addPage(page));

  return await subPdf.save();
}

/**
 * Reorder, rotate, delete, or duplicate pages in a PDF
 */
export async function manipulatePdfPages(
  pdfBuffer: ArrayBuffer,
  pageActions: {
    pageIndex: number;
    rotationDelta?: number; // 90, 180, 270
    delete?: boolean;
    duplicate?: boolean;
  }[],
  pageOrder?: number[]
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();
  const total = srcPdf.getPageCount();

  let targetOrder = pageOrder || Array.from({ length: total }, (_, i) => i);

  // Apply deletions
  const toDelete = new Set(
    pageActions.filter((a) => a.delete).map((a) => a.pageIndex)
  );
  targetOrder = targetOrder.filter((idx) => !toDelete.has(idx));

  // Copy pages
  for (const idx of targetOrder) {
    if (idx >= 0 && idx < total) {
      const [copied] = await newPdf.copyPages(srcPdf, [idx]);
      
      // Check for rotation delta
      const action = pageActions.find((a) => a.pageIndex === idx);
      if (action?.rotationDelta) {
        const currentRot = copied.getRotation().angle;
        copied.setRotation(degrees((currentRot + action.rotationDelta) % 360));
      }

      newPdf.addPage(copied);

      // Duplicate if requested
      if (action?.duplicate) {
        const [duplicateCopy] = await newPdf.copyPages(srcPdf, [idx]);
        newPdf.addPage(duplicateCopy);
      }
    }
  }

  return await newPdf.save();
}

/**
 * Apply annotations, text overlays, watermarks, redactions, and signatures to PDF
 */
export async function applyPdfModifications(
  pdfBuffer: ArrayBuffer,
  annotations: PDFAnnotation[],
  options?: {
    watermarkText?: string;
    addPageNumbers?: boolean;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Apply general watermark if specified
  if (options?.watermarkText) {
    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText(options.watermarkText, {
        x: width / 4,
        y: height / 2,
        size: 50,
        font: boldFont,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.35,
        rotate: degrees(45),
      });
    }
  }

  // Apply page numbers if specified
  if (options?.addPageNumbers) {
    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const { width } = page.getSize();
      const text = `Page ${i + 1} of ${totalPages}`;
      page.drawText(text, {
        x: width / 2 - 30,
        y: 25,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  // Apply individual annotations
  for (const ann of annotations) {
    if (ann.pageIndex < 0 || ann.pageIndex >= pages.length) continue;
    const page = pages[ann.pageIndex];
    const { height } = page.getSize();

    // Note: PDF coordinate system has (0,0) at bottom-left
    const pdfY = height - ann.y;

    if (ann.type === 'text' && ann.text) {
      page.drawText(ann.text, {
        x: ann.x,
        y: pdfY,
        size: ann.fontSize || 14,
        font,
        color: hexToRgb(ann.color || '#000000'),
        opacity: ann.opacity ?? 1,
      });
    } else if (ann.type === 'redact') {
      // True black redaction box
      page.drawRectangle({
        x: ann.x,
        y: pdfY - (ann.height || 20),
        width: ann.width || 100,
        height: ann.height || 20,
        color: rgb(0, 0, 0),
        opacity: 1,
      });
    } else if (ann.type === 'highlight') {
      page.drawRectangle({
        x: ann.x,
        y: pdfY - (ann.height || 18),
        width: ann.width || 80,
        height: ann.height || 18,
        color: hexToRgb(ann.color || '#fef08a'),
        opacity: 0.45,
      });
    } else if (ann.type === 'watermark' && ann.text) {
      page.drawText(ann.text, {
        x: ann.x,
        y: pdfY,
        size: ann.fontSize || 36,
        font: boldFont,
        color: hexToRgb(ann.color || '#ef4444'),
        opacity: ann.opacity ?? 0.3,
        rotate: degrees(ann.rotation || 0),
      });
    } else if (ann.type === 'signature' && ann.dataUrl) {
      try {
        const imageBytes = await (await fetch(ann.dataUrl)).arrayBuffer();
        const embeddedImage = await pdfDoc.embedPng(imageBytes);
        page.drawImage(embeddedImage, {
          x: ann.x,
          y: pdfY - (ann.height || 60),
          width: ann.width || 140,
          height: ann.height || 60,
          opacity: ann.opacity ?? 1,
        });
      } catch (err) {
        console.warn('Failed to embed signature into PDF:', err);
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Helper to convert #rrggbb to pdf-lib rgb()
 */
function hexToRgb(hex: string) {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return rgb(0, 0, 0);
  const r = parseInt(sanitized.substring(0, 2), 16) / 255;
  const g = parseInt(sanitized.substring(2, 4), 16) / 255;
  const b = parseInt(sanitized.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}
