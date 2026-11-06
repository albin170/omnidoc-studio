import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFAnnotation, PdfTextEdit, PdfTextItem } from '../types';

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
  try {
    const loadingTask = pdfjsLib.getDocument({ data });
    return await loadingTask.promise;
  } catch (err: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Failed to load PDF viewer: Network offline and worker assets could not be fetched.');
    }
    throw new Error(`Failed to load PDF: ${err?.message || 'Invalid or corrupted PDF file.'}`);
  }
}

/**
 * Extract selectable text items with exact canvas viewport and PDF page coordinates
 * Enables clicking/double-clicking existing text for in-place editing (Module 4A).
 */
export async function extractPageTextItems(
  pdfJsDoc: any,
  pageNumber: number,
  scale: number = 1.0
): Promise<PdfTextItem[]> {
  const page = await pdfJsDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent();
  const items: PdfTextItem[] = [];

  for (let i = 0; i < textContent.items.length; i++) {
    const it = textContent.items[i] as any;
    if (!it.str || !it.str.trim()) continue;

    const tx = it.transform[4];
    const ty = it.transform[5];
    const fontSize = Math.max(8, Math.round(Math.sqrt(it.transform[0] ** 2 + it.transform[1] ** 2)));
    const [vx, vy] = viewport.convertToViewportPoint(tx, ty);

    const itemWidth = Math.max(12, it.width * scale);
    const itemHeight = Math.max(fontSize * scale, (it.height || fontSize) * scale);
    const viewportY = Math.max(0, vy - itemHeight);

    items.push({
      id: `txt-${pageNumber}-${i}`,
      str: it.str,
      pdfX: tx,
      pdfY: ty,
      viewportX: vx,
      viewportY,
      width: itemWidth,
      height: itemHeight,
      fontSize,
      fontName: it.fontName,
    });
  }

  return items;
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
 * Insert a blank page into the PDF
 */
export async function insertBlankPage(
  pdfBuffer: ArrayBuffer | Uint8Array,
  atIndex?: number,
  width: number = 612,
  height: number = 792
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const idx = atIndex !== undefined && atIndex >= 0 ? Math.min(atIndex, pdfDoc.getPageCount()) : pdfDoc.getPageCount();
  pdfDoc.insertPage(idx, [width, height]);
  return await pdfDoc.save();
}

/**
 * Delete a specific page from the PDF
 */
export async function deletePdfPage(
  pdfBuffer: ArrayBuffer | Uint8Array,
  pageIndex: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  if (pdfDoc.getPageCount() <= 1) {
    throw new Error('Cannot delete the only page of a document.');
  }
  if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
    pdfDoc.removePage(pageIndex);
  }
  return await pdfDoc.save();
}

/**
 * Duplicate a specific page in the PDF
 */
export async function duplicatePdfPage(
  pdfBuffer: ArrayBuffer | Uint8Array,
  pageIndex: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
    const [copied] = await pdfDoc.copyPages(pdfDoc, [pageIndex]);
    pdfDoc.insertPage(pageIndex + 1, copied);
  }
  return await pdfDoc.save();
}

/**
 * Rotate a specific page by delta degrees
 */
export async function rotatePdfPage(
  pdfBuffer: ArrayBuffer | Uint8Array,
  pageIndex: number,
  deltaDegrees: number = 90
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
    const page = pdfDoc.getPage(pageIndex);
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + deltaDegrees) % 360));
  }
  return await pdfDoc.save();
}

/**
 * Reorder pages in a PDF given an array of page indices
 */
export async function reorderPdfPages(
  pdfBuffer: ArrayBuffer | Uint8Array,
  newOrder: number[]
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();
  const total = srcPdf.getPageCount();
  const validOrder = newOrder.filter((idx) => idx >= 0 && idx < total);
  const copied = await newPdf.copyPages(srcPdf, validOrder);
  copied.forEach((p) => newPdf.addPage(p));
  return await newPdf.save();
}

/**
 * Extract selected pages (0-based) into a new PDF
 */
export async function extractSelectedPages(
  pdfBuffer: ArrayBuffer | Uint8Array,
  selectedIndices: number[]
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();
  const total = srcPdf.getPageCount();
  const validIndices = selectedIndices.filter((idx) => idx >= 0 && idx < total);
  if (validIndices.length === 0) {
    throw new Error('Please select at least one valid page to extract.');
  }
  const copied = await newPdf.copyPages(srcPdf, validIndices);
  copied.forEach((p) => newPdf.addPage(p));
  return await newPdf.save();
}

/**
 * Verify PDF integrity by parsing with PDFDocument
 */
export async function verifyPdfIntegrity(
  pdfBytes: ArrayBuffer | Uint8Array
): Promise<{ valid: boolean; isValid: boolean; pageCount: number; sizeBytes: number; error?: string }> {
  try {
    const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    const doc = await PDFDocument.load(data, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    return { 
      valid: pageCount > 0, 
      isValid: pageCount > 0, 
      pageCount, 
      sizeBytes: data.byteLength 
    };
  } catch (err: any) {
    const size = pdfBytes instanceof Uint8Array ? pdfBytes.byteLength : pdfBytes.byteLength;
    return { 
      valid: false, 
      isValid: false, 
      pageCount: 0, 
      sizeBytes: size, 
      error: err?.message || 'Verification failed: invalid PDF' 
    };
  }
}

/**
 * Apply annotations, text overlays, watermarks, redactions, and signatures to PDF
 */
export async function applyPdfModifications(
  pdfBuffer: ArrayBuffer | Uint8Array,
  annotations: PDFAnnotation[],
  options?: {
    watermarkText?: string;
    addPageNumbers?: boolean;
    textEdits?: PdfTextEdit[];
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
  const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const courierOblique = await pdfDoc.embedFont(StandardFonts.CourierOblique);

  // Helper to pick font
  const selectFont = (family?: string, weight?: string, style?: string) => {
    if (family === 'TimesRoman') {
      if (weight === 'bold') return timesBold;
      if (style === 'italic') return timesItalic;
      return timesFont;
    }
    if (family === 'Courier') {
      if (weight === 'bold') return courierBold;
      if (style === 'italic') return courierOblique;
      return courierFont;
    }
    if (weight === 'bold') return boldFont;
    if (style === 'italic') return italicFont;
    return helveticaFont;
  };

  // 1. Apply direct existing text edits (Module 4A: Genuine in-place text editing)
  if (options?.textEdits && options.textEdits.length > 0) {
    for (const edit of options.textEdits) {
      if (edit.pageIndex < 0 || edit.pageIndex >= pages.length) continue;
      const page = pages[edit.pageIndex];

      const isRedact = edit.isRedaction || false;

      // Opaque background rectangle wiping original text (white for edit/delete, black for redact)
      page.drawRectangle({
        x: Math.max(0, edit.pdfX - 2),
        y: Math.max(0, edit.pdfY - 2),
        width: Math.max(10, edit.width + 4),
        height: Math.max(10, edit.height + 4),
        color: isRedact ? rgb(0, 0, 0) : rgb(1, 1, 1),
        opacity: 1.0,
      });

      // Render replacement text
      if (!edit.isDeleted && !isRedact && edit.newText && edit.newText.trim().length > 0) {
        const chosenFont = selectFont(edit.fontFamily, edit.fontWeight, edit.fontStyle);
        const fontSize = edit.fontSize || 12;
        let drawX = edit.pdfX;
        
        if (edit.textAlign === 'center' || edit.textAlign === 'right') {
          const textWidth = chosenFont.widthOfTextAtSize(edit.newText, fontSize);
          if (edit.textAlign === 'center') {
            drawX = edit.pdfX + Math.max(0, (edit.width - textWidth) / 2);
          } else if (edit.textAlign === 'right') {
            drawX = edit.pdfX + Math.max(0, edit.width - textWidth);
          }
        }

        page.drawText(edit.newText, {
          x: drawX,
          y: edit.pdfY,
          size: fontSize,
          font: chosenFont,
          color: hexToRgb(edit.fontColor || '#000000'),
          opacity: 1.0,
        });
      }
    }
  }

  // 2. Apply general watermark if specified
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

  // 3. Apply page numbers if specified
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
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  // 4. Apply annotations
  for (const ann of annotations) {
    if (ann.pageIndex < 0 || ann.pageIndex >= pages.length) continue;
    const page = pages[ann.pageIndex];
    const { height } = page.getSize();

    // PDF coordinate system (0,0 is bottom-left)
    const pdfY = height - ann.y;

    if (ann.type === 'text' && ann.text) {
      page.drawText(ann.text, {
        x: ann.x,
        y: pdfY,
        size: ann.fontSize || 14,
        font: helveticaFont,
        color: hexToRgb(ann.color || '#000000'),
        opacity: ann.opacity ?? 1,
      });
    } else if (ann.type === 'redact') {
      // True secure blackout box
      page.drawRectangle({
        x: ann.x,
        y: pdfY - (ann.height || 20),
        width: ann.width || 100,
        height: ann.height || 20,
        color: rgb(0, 0, 0),
        opacity: 1.0,
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
    } else if (ann.type === 'underline') {
      page.drawLine({
        start: { x: ann.x, y: pdfY - (ann.height || 14) },
        end: { x: ann.x + (ann.width || 80), y: pdfY - (ann.height || 14) },
        thickness: 1.5,
        color: hexToRgb(ann.color || '#2563eb'),
      });
    } else if (ann.type === 'strikethrough') {
      page.drawLine({
        start: { x: ann.x, y: pdfY - (ann.height || 14) / 2 },
        end: { x: ann.x + (ann.width || 80), y: pdfY - (ann.height || 14) / 2 },
        thickness: 1.5,
        color: hexToRgb(ann.color || '#ef4444'),
      });
    } else if (ann.type === 'rectangle') {
      page.drawRectangle({
        x: ann.x,
        y: pdfY - (ann.height || 40),
        width: ann.width || 120,
        height: ann.height || 40,
        borderColor: hexToRgb(ann.color || '#3b82f6'),
        borderWidth: 2,
        opacity: ann.opacity ?? 1,
      });
    } else if (ann.type === 'line') {
      page.drawLine({
        start: { x: ann.x, y: pdfY },
        end: { x: ann.x + (ann.width || 100), y: pdfY - (ann.height || 0) },
        thickness: 2,
        color: hexToRgb(ann.color || '#3b82f6'),
      });
    } else if (ann.type === 'comment' && ann.text) {
      page.drawRectangle({
        x: ann.x,
        y: pdfY - 24,
        width: 24,
        height: 24,
        color: rgb(1, 0.85, 0.2),
        borderColor: rgb(0.8, 0.6, 0),
        borderWidth: 1.5,
      });
      page.drawText('!', {
        x: ann.x + 8,
        y: pdfY - 18,
        size: 14,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
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
    } else if (ann.type === 'image' && ann.dataUrl) {
      try {
        const imageBytes = await (await fetch(ann.dataUrl)).arrayBuffer();
        let embeddedImage: any;
        if (ann.dataUrl.startsWith('data:image/jpeg') || ann.dataUrl.startsWith('data:image/jpg')) {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        }
        page.drawImage(embeddedImage, {
          x: ann.x,
          y: pdfY - (ann.height || 80),
          width: ann.width || 120,
          height: ann.height || 80,
          opacity: ann.opacity ?? 1,
        });
      } catch (err) {
        console.warn('Failed to embed image into PDF:', err);
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
