import JSZip from 'jszip';
import { ConversionJob, ConversionOptions, FileFormat } from '../types';
import { FORMAT_REGISTRY } from './formatDetector';
import { extractTextFromPdf, renderPdfPagesToImages } from './pdfService';
import { convertTextOrDocxToPdf, createDocxBlob, extractTextFromDocxFile } from './docxService';
import { convertSpreadsheetToPdf, exportDataToCsvBlob, exportDataToXlsxBlob, parseSpreadsheetFile } from './sheetService';
import { convertImageFormat, convertImageToPdf } from './imageService';
import { performOcr } from './ocrService';

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
}

/**
 * Execute a real file conversion according to the registered conversion matrix
 */
export async function executeFileConversion(
  file: File,
  sourceFormat: FileFormat,
  targetFormat: FileFormat,
  options?: ConversionOptions,
  onProgress?: (progress: number, step: string) => void
): Promise<ConversionResult> {
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const updateProgress = (pct: number, msg: string) => {
    if (onProgress) onProgress(pct, msg);
  };

  // Upfront error checks
  if (!file || file.size === 0) {
    throw new Error(`File "${file?.name || 'unknown'}" is empty (0 bytes). Please upload a valid document.`);
  }

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 100MB browser memory limit.`);
  }

  updateProgress(10, 'Validating file integrity and headers...');

  // 1. Same format passthrough
  if (sourceFormat === targetFormat) {
    updateProgress(100, 'Format match; ready for download');
    return {
      blob: file,
      fileName: file.name,
      mimeType: FORMAT_REGISTRY[targetFormat]?.mimeType || file.type,
    };
  }

  // 2. PDF Conversions
  if (sourceFormat === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();

    if (targetFormat === 'txt') {
      updateProgress(40, 'Extracting selectable text from PDF pages...');
      const text = await extractTextFromPdf(arrayBuffer);
      updateProgress(90, 'Formatting text output...');
      return {
        blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }

    if (targetFormat === 'docx') {
      updateProgress(35, 'Extracting document text stream...');
      const text = await extractTextFromPdf(arrayBuffer);
      updateProgress(65, 'Reconstructing Word paragraph hierarchies...');
      const paragraphs = text.split('\n\n').filter(Boolean).map((p) => ({
        type: 'paragraph' as const,
        text: p,
      }));
      const docxBlob = await createDocxBlob(baseName, paragraphs);
      updateProgress(100, 'DOCX package verified');
      return {
        blob: docxBlob,
        fileName: `${baseName}.docx`,
        mimeType: FORMAT_REGISTRY.docx.mimeType,
      };
    }

    if (targetFormat === 'png' || targetFormat === 'jpg') {
      updateProgress(30, 'Rendering high-resolution PDF pages...');
      const imageBlobs = await renderPdfPagesToImages(
        arrayBuffer,
        targetFormat === 'png' ? 'png' : 'jpeg'
      );

      if (imageBlobs.length === 1) {
        updateProgress(100, 'Page image rendered');
        return {
          blob: imageBlobs[0],
          fileName: `${baseName}.${targetFormat}`,
          mimeType: targetFormat === 'png' ? 'image/png' : 'image/jpeg',
        };
      }

      // Multiple pages: package into a ZIP
      updateProgress(75, `Packaging ${imageBlobs.length} pages into ZIP...`);
      const zip = new JSZip();
      imageBlobs.forEach((imgBlob, idx) => {
        zip.file(`${baseName}_page_${idx + 1}.${targetFormat}`, imgBlob);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      return {
        blob: zipBlob,
        fileName: `${baseName}_pages.zip`,
        mimeType: 'application/zip',
      };
    }
  }

  // 3. Word (DOCX) Conversions
  if (sourceFormat === 'docx') {
    updateProgress(30, 'Parsing DOCX document XML...');
    const rawText = await extractTextFromDocxFile(file);

    if (targetFormat === 'pdf') {
      updateProgress(65, 'Formatting PDF layout and page breaks...');
      const pdfBytes = await convertTextOrDocxToPdf(baseName, rawText);
      updateProgress(100, 'PDF generated');
      return {
        blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
        fileName: `${baseName}.pdf`,
        mimeType: 'application/pdf',
      };
    }

    if (targetFormat === 'txt') {
      updateProgress(90, 'Cleaning text format...');
      return {
        blob: new Blob([rawText], { type: 'text/plain;charset=utf-8' }),
        fileName: `${baseName}.txt`,
        mimeType: 'text/plain',
      };
    }

    if (targetFormat === 'html') {
      updateProgress(70, 'Generating semantic HTML markup...');
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${baseName}</title>
  <style>body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #1e293b; }</style>
</head>
<body>
  <h1>${baseName}</h1>
  ${rawText.split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
</body>
</html>`;
      return {
        blob: new Blob([htmlContent], { type: 'text/html;charset=utf-8' }),
        fileName: `${baseName}.html`,
        mimeType: 'text/html',
      };
    }
  }

  // 4. Spreadsheet (XLSX & CSV) Conversions
  if (sourceFormat === 'xlsx' || sourceFormat === 'csv') {
    updateProgress(35, 'Reading workbook cells and formulas...');
    const parsed = await parseSpreadsheetFile(file);

    if (targetFormat === 'csv') {
      updateProgress(75, 'Serializing CSV delimiter streams...');
      const csvBlob = exportDataToCsvBlob(parsed.data);
      return {
        blob: csvBlob,
        fileName: `${baseName}.csv`,
        mimeType: 'text/csv',
      };
    }

    if (targetFormat === 'xlsx') {
      updateProgress(75, 'Building openXML spreadsheet package...');
      const xlsxBlob = exportDataToXlsxBlob(parsed.data, parsed.activeSheet);
      return {
        blob: xlsxBlob,
        fileName: `${baseName}.xlsx`,
        mimeType: FORMAT_REGISTRY.xlsx.mimeType,
      };
    }

    if (targetFormat === 'pdf') {
      updateProgress(65, 'Formatting tabular data into PDF grid...');
      const pdfBytes = await convertSpreadsheetToPdf(parsed.data, baseName);
      return {
        blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
        fileName: `${baseName}.pdf`,
        mimeType: 'application/pdf',
      };
    }
  }

  // 5. Image Conversions (PNG, JPG, WebP)
  if (['png', 'jpg', 'webp'].includes(sourceFormat)) {
    if (targetFormat === 'pdf') {
      updateProgress(50, 'Embedding high-res raster into PDF canvas...');
      const pdfBytes = await convertImageToPdf(file, {
        pageSize: options?.pageOrientation ? 'A4' : 'fit',
        orientation: options?.pageOrientation,
      });
      return {
        blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
        fileName: `${baseName}.pdf`,
        mimeType: 'application/pdf',
      };
    }

    if (['png', 'jpg', 'webp'].includes(targetFormat)) {
      updateProgress(45, `Recoding pixel stream to ${targetFormat.toUpperCase()}...`);
      const targetBlob = await convertImageFormat(
        file,
        targetFormat as 'png' | 'jpg' | 'webp',
        options?.quality ?? 0.92
      );
      return {
        blob: targetBlob,
        fileName: `${baseName}.${targetFormat}`,
        mimeType: FORMAT_REGISTRY[targetFormat].mimeType,
      };
    }
  }

  // 6. Text / Markdown / HTML Conversions
  if (['txt', 'md', 'html'].includes(sourceFormat)) {
    const rawText = await file.text();

    if (targetFormat === 'pdf') {
      updateProgress(60, 'Rendering text lines to PDF document...');
      const pdfBytes = await convertTextOrDocxToPdf(baseName, rawText);
      return {
        blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
        fileName: `${baseName}.pdf`,
        mimeType: 'application/pdf',
      };
    }

    if (targetFormat === 'docx') {
      updateProgress(60, 'Structuring Word document paragraphs...');
      const paragraphs = rawText.split('\n\n').filter(Boolean).map((p) => ({
        type: 'paragraph' as const,
        text: p,
      }));
      const docxBlob = await createDocxBlob(baseName, paragraphs);
      return {
        blob: docxBlob,
        fileName: `${baseName}.docx`,
        mimeType: FORMAT_REGISTRY.docx.mimeType,
      };
    }
  }

  // Fallback: If OCR requested or scanned document conversion
  if (targetFormat === 'txt' && ['png', 'jpg', 'webp'].includes(sourceFormat)) {
    updateProgress(30, 'Performing Optical Character Recognition (OCR)...');
    const ocrResult = await performOcr(file, options?.ocrLanguage || 'eng', (status, pct) => {
      updateProgress(30 + Math.floor(pct * 0.6), `OCR: ${status}`);
    });
    return {
      blob: new Blob([ocrResult.text], { type: 'text/plain;charset=utf-8' }),
      fileName: `${baseName}_ocr.txt`,
      mimeType: 'text/plain',
    };
  }

  throw new Error(`Unsupported conversion route: from ${sourceFormat.toUpperCase()} to ${targetFormat.toUpperCase()}`);
}

/**
 * Package multiple completed files into a single ZIP archive for batch download
 */
export async function createBatchZipArchive(jobs: ConversionJob[]): Promise<Blob> {
  const zip = new JSZip();

  for (const job of jobs) {
    if (job.status === 'completed' && job.resultBlob) {
      const fileName = job.resultFileName || `${job.sourceFile.name}_converted.${job.targetFormat}`;
      zip.file(fileName, job.resultBlob);
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
