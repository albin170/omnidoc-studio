import JSZip from 'jszip';
import { FileFormat, BatchJobItem } from '../types';
import { executeFileConversion } from './converter';
import { validateDocumentStructure } from './fileValidator';

export interface BatchRunProgress {
  total: number;
  completed: number;
  failed: number;
  currentFileName: string;
}

export type BatchProgressListener = (progress: BatchRunProgress) => void;

/**
 * Execute batch conversion on a collection of files and bundle into a ZIP
 */
export async function runBatchConversion(
  items: { file: File; targetFormat: FileFormat }[],
  namingPattern = '{original}_converted',
  onProgress?: BatchProgressListener
): Promise<{ zipBlob: Blob; report: string; jobs: BatchJobItem[] }> {
  const zip = new JSZip();
  const jobs: BatchJobItem[] = items.map((i) => ({
    file: i.file,
    targetFormat: i.targetFormat,
    status: 'pending',
  }));

  let completedCount = 0;
  let failedCount = 0;

  for (let idx = 0; idx < jobs.length; idx++) {
    const job = jobs[idx];
    const file = job.file;
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    if (onProgress) {
      onProgress({
        total: jobs.length,
        completed: completedCount,
        failed: failedCount,
        currentFileName: file.name,
      });
    }

    job.status = 'processing';

    try {
      // Step 1: Structural validation
      const validation = await validateDocumentStructure(file);
      if (!validation.valid || !validation.format) {
        throw new Error(validation.error || 'Document failed structural validation');
      }

      // Step 2: Conversion
      const result = await executeFileConversion(
        file,
        validation.format,
        job.targetFormat
      );

      // Step 3: Compute output filename
      const formattedDate = new Date().toISOString().slice(0, 10);
      const computedName = namingPattern
        .replace('{original}', baseName)
        .replace('{index}', String(idx + 1))
        .replace('{date}', formattedDate)
        .replace('{target}', job.targetFormat);

      const finalFileName = `${computedName}.${job.targetFormat}`;
      job.outputName = finalFileName;
      job.resultBlob = result.blob;
      job.status = 'done';

      // Add to ZIP package
      zip.file(finalFileName, result.blob);
      completedCount++;
    } catch (err: any) {
      job.status = 'failed';
      job.error = err?.message || 'Conversion failed';
      failedCount++;
    }
  }

  // Generate manifest report inside zip
  const reportLines = [
    `# OmniDoc Studio — Batch Conversion Report`,
    `Execution Timestamp: ${new Date().toISOString()}`,
    `Total Files Processed: ${jobs.length}`,
    `Successfully Converted: ${completedCount}`,
    `Failed: ${failedCount}`,
    ``,
    `## File Summary`,
  ];

  jobs.forEach((j, i) => {
    reportLines.push(
      `${i + 1}. [${j.status.toUpperCase()}] "${j.file.name}" -> ${j.outputName || 'N/A'}${j.error ? ` (Error: ${j.error})` : ''}`
    );
  });

  const reportText = reportLines.join('\n');
  zip.file('BATCH_SUMMARY.txt', reportText);

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  if (onProgress) {
    onProgress({
      total: jobs.length,
      completed: completedCount,
      failed: failedCount,
      currentFileName: 'Complete',
    });
  }

  return { zipBlob, report: reportText, jobs };
}
