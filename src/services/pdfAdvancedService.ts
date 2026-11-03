import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  opacity?: number;
  rotationDegrees?: number;
  color?: { r: number; g: number; b: number };
}

export interface PageNumberOptions {
  position?: 'bottom-center' | 'bottom-right' | 'top-right';
  format?: 'page_of_total' | 'page_only';
  fontSize?: number;
}

/**
 * Merge multiple PDF files into a single consolidated PDF document
 */
export async function mergePdfFiles(files: File[]): Promise<Blob> {
  if (!files || files.length < 2) {
    throw new Error('At least 2 PDF files are required for merging.');
  }

  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageIndices = pdfDoc.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Split a PDF by selecting specific page indices (1-based)
 */
export async function splitPdfPages(file: File, selectedPageNumbers: number[]): Promise<Blob> {
  if (!selectedPageNumbers || selectedPageNumbers.length === 0) {
    throw new Error('Please select at least one page to extract.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const totalPages = sourcePdf.getPageCount();

  const newPdf = await PDFDocument.create();
  // Convert 1-based to 0-based and filter in bounds
  const validIndices = selectedPageNumbers
    .map((num) => num - 1)
    .filter((idx) => idx >= 0 && idx < totalPages);

  if (validIndices.length === 0) {
    throw new Error('No valid pages found within document range.');
  }

  const copiedPages = await newPdf.copyPages(sourcePdf, validIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const splitBytes = await newPdf.save();
  return new Blob([splitBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Apply a diagonal semi-transparent watermark across all pages
 */
export async function watermarkPdf(file: File, options: WatermarkOptions): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const text = options.text || 'CONFIDENTIAL';
  const fontSize = options.fontSize || 48;
  const opacity = options.opacity !== undefined ? options.opacity : 0.25;
  const rot = options.rotationDegrees !== undefined ? options.rotationDegrees : 45;
  const clr = options.color || { r: 0.8, g: 0.1, b: 0.1 };

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    page.drawText(text, {
      x: width / 2 - textWidth / 2 + 10,
      y: height / 2 - textHeight / 2,
      size: fontSize,
      font,
      color: rgb(clr.r, clr.g, clr.b),
      opacity,
      rotate: degrees(rot),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Rotate pages in a PDF document by 90, 180, or 270 degrees
 */
export async function rotatePdfPages(file: File, rotationDeg: 90 | 180 | 270): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + rotationDeg) % 360));
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Stamp dynamic page numbers on all pages (e.g. "Page 1 of 5")
 */
export async function addPageNumbersToPdf(file: File, options: PageNumberOptions = {}): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const fontSize = options.fontSize || 10;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    const pageNum = i + 1;
    const label = options.format === 'page_only' ? `Page ${pageNum}` : `Page ${pageNum} of ${totalPages}`;
    const textWidth = font.widthOfTextAtSize(label, fontSize);

    let x = width / 2 - textWidth / 2; // bottom-center default
    let y = 20;

    if (options.position === 'bottom-right') {
      x = width - textWidth - 30;
      y = 20;
    } else if (options.position === 'top-right') {
      x = width - textWidth - 30;
      y = page.getSize().height - 25;
    }

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.35, 0.4, 0.45),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
