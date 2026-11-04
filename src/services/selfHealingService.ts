import {
  FileFormat,
  SelfHealingResult
} from '../types';
import { generateDocumentDna, compareDocumentDna } from './documentDnaService';
import { executeFileConversion } from './converter';
import { createTransformationReceipt } from './receiptService';
import { extractTextFromDocxFile, convertTextOrDocxToPdf } from './docxService';
import { parseSpreadsheetFile, convertSheetDataToPdf } from './sheetService';
import { extractTextFromPptxFile } from './pptxService';

/**
 * Execute conversion with automatic integrity verification and self-healing recovery.
 * Compares genuinely different conversion engines, measures Document DNA before and after,
 * never artificially inflates scores, and preserves both outputs for comparison.
 */
export async function convertWithSelfHealing(
  file: File | Blob,
  sourceFormat: FileFormat,
  targetFormat: FileFormat
): Promise<SelfHealingResult> {
  const startTime = Date.now();
  const rawName = file instanceof File ? file.name : `document.${sourceFormat}`;
  const baseName = rawName.substring(0, rawName.lastIndexOf('.')) || rawName;
  const fileName = `${baseName}.${sourceFormat}`;
  const fileObj = file instanceof File ? file : new File([file], fileName, { type: file.type || 'application/octet-stream' });
  
  const sourceDna = await generateDocumentDna(fileObj, fileName);

  // 1. Primary Conversion Attempt
  let primaryBlob: Blob;
  let primaryFileName = `${baseName}.${targetFormat}`;
  let primarySuccess = true;

  try {
    const result = await executeFileConversion(fileObj, sourceFormat, targetFormat);
    primaryBlob = result.blob;
    primaryFileName = result.fileName;
  } catch {
    primarySuccess = false;
    primaryBlob = new Blob([], { type: 'application/octet-stream' });
    primaryFileName = `${baseName}.${targetFormat}`;
  }

  // 2. Structural DNA Verification of Primary Output
  let beforeScore = 0;
  if (primarySuccess && primaryBlob.size > 0) {
    const targetDna = await generateDocumentDna(primaryBlob, primaryFileName);
    const comparison = compareDocumentDna(sourceDna, targetDna);
    beforeScore = comparison.integrityScore;
  }

  // 3. Determine if Self-Healing Recovery is necessary
  // Recovery triggered if primary failed or integrity score dropped below 70
  const needsHealing = !primarySuccess || primaryBlob.size === 0 || beforeScore < 70;

  if (!needsHealing) {
    // High fidelity conversion verified — no healing required
    const receipt = await createTransformationReceipt({
      sourceFile: fileObj,
      sourceFormat,
      targetBlob: primaryBlob,
      targetFileName: primaryFileName,
      targetFormat,
      integrityScore: beforeScore,
      warningCount: 0,
      errorCount: 0,
      executionDurationMs: Date.now() - startTime,
    });

    return {
      primarySuccess: true,
      recoveryAttempted: false,
      recovered: false,
      strategyUsed: 'primary',
      beforeScore,
      afterScore: beforeScore,
      scoreDifference: 0,
      outputBlob: primaryBlob,
      outputFileName: primaryFileName,
      receiptId: receipt.receiptId,
      primaryBlob,
    };
  }

  // 4. Execute Genuinely Alternative Recovery Strategy
  let healedBlob: Blob = primaryBlob;
  let candidateStrategy: SelfHealingResult['strategyUsed'] = 'structured_fallback';
  let repairDescription = '';

  try {
    if (sourceFormat === 'docx' && targetFormat === 'pdf') {
      candidateStrategy = 'structured_fallback';
      repairDescription = 'Applied paragraph hierarchy linearization and text extraction stream to prevent font and table clipping.';
      const extractedText = await extractTextFromDocxFile(fileObj);
      const pdfBytes = await convertTextOrDocxToPdf(baseName, extractedText);
      healedBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    } else if ((sourceFormat === 'xlsx' || sourceFormat === 'csv') && targetFormat === 'pdf') {
      candidateStrategy = 'compact_table_scaling';
      repairDescription = 'Compacted cell coordinates into dense landscape A4 grid with auto-wrapped text.';
      const parsedSheet = await parseSpreadsheetFile(fileObj);
      const pdfBytes = await convertSheetDataToPdf(baseName, parsedSheet.data);
      healedBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    } else if (sourceFormat === 'pptx' && targetFormat === 'pdf') {
      candidateStrategy = 'structured_fallback';
      repairDescription = 'Linearized multi-slide textual elements into a structured document.';
      const slideTexts = await extractTextFromPptxFile(fileObj);
      const combined = slideTexts.map((s, idx) => `--- SLIDE ${idx + 1} ---\n${s}`).join('\n\n');
      const pdfBytes = await convertTextOrDocxToPdf(baseName, combined);
      healedBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    } else {
      candidateStrategy = 'structured_fallback';
      repairDescription = 'Applied Unicode UTF-8 normalization and sanitized formatting entities.';
      const text = await fileObj.text();
      const sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      const altFile = new File([sanitized], fileName, { type: 'text/plain' });
      const altResult = await executeFileConversion(altFile, sourceFormat, targetFormat);
      healedBlob = altResult.blob;
    }
  } catch (err: any) {
    candidateStrategy = 'none';
    repairDescription = `Alternative recovery strategy failed: ${err?.message || 'Execution error'}`;
  }

  // 5. Measure DNA of Alternative Output
  let healedScore = 0;
  if (healedBlob && healedBlob.size > 0) {
    try {
      const healedDna = await generateDocumentDna(healedBlob, primaryFileName);
      const healedComp = compareDocumentDna(sourceDna, healedDna);
      healedScore = healedComp.integrityScore;
    } catch {
      healedScore = 0;
    }
  }

  // 6. Honest Comparison (BUG-03 Fix): Never artificially inflate score via Math.max
  const isRecovered = healedScore > beforeScore;
  const afterScore = isRecovered ? healedScore : beforeScore;
  const finalOutputBlob = isRecovered ? healedBlob : primaryBlob;
  const finalStrategy = isRecovered ? candidateStrategy : 'none';
  const scoreDifference = healedScore - beforeScore;

  if (!isRecovered && primarySuccess) {
    repairDescription = `Evaluated alternative strategy (${candidateStrategy}, scored ${healedScore}%), but primary output maintained superior fidelity (${beforeScore}%). Primary output retained.`;
  }

  const duration = Date.now() - startTime;
  const finalReceipt = await createTransformationReceipt({
    sourceFile: fileObj,
    sourceFormat,
    targetBlob: finalOutputBlob,
    targetFileName: primaryFileName,
    targetFormat,
    integrityScore: afterScore,
    warningCount: afterScore < 80 ? 1 : 0,
    errorCount: isRecovered || primarySuccess ? 0 : 1,
    executionDurationMs: duration,
  });

  return {
    primarySuccess,
    recoveryAttempted: true,
    recovered: isRecovered,
    strategyUsed: finalStrategy,
    proposedRepairDescription: repairDescription,
    beforeScore,
    afterScore,
    scoreDifference,
    outputBlob: finalOutputBlob,
    outputFileName: primaryFileName,
    receiptId: finalReceipt.receiptId,
    primaryBlob,
    healedBlob,
  };
}
