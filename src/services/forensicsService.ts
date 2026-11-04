import JSZip from 'jszip';
import { ForensicsReport, ForensicsFinding } from '../types';
import { validateFileFormat } from './formatDetector';
import { computeFileHash } from './documentDnaService';

/**
 * Inspect magic bytes from file header
 */
async function detectMagicFormat(file: File | Blob): Promise<string | null> {
  try {
    const slice = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(slice);
    if (bytes.length >= 4) {
      // PDF
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return 'pdf';
      }
      // PNG
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return 'png';
      }
      // JPEG
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'jpg';
      }
      // ZIP / OpenXML package (PK\x03\x04)
      if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
        try {
          const zip = await JSZip.loadAsync(await file.arrayBuffer());
          if (zip.file('word/document.xml')) return 'docx';
          if (zip.file('xl/workbook.xml')) return 'xlsx';
          if (zip.file('ppt/presentation.xml')) return 'pptx';
        } catch { }
        return 'zip'; // Generic ZIP container (BUG-09 Fix: not docx)
      }
      // Legacy OLE2
      if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
        return 'doc';
      }
    }
  } catch { }
  return null;
}

/**
 * Perform technical structural forensics on any document.
 * Analyzes metadata leaks, extension spoofing, external URI targets,
 * macro attachments, and archive structure.
 */
export async function inspectDocumentForensics(file: File): Promise<ForensicsReport> {
  const sha256 = await computeFileHash(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const validation = await validateFileFormat(file);
  const detectedMagic = await detectMagicFormat(file);
  const actualFormat = detectedMagic || validation.format || null;

  const findings: ForensicsFinding[] = [];
  const metadataSummary: Record<string, string> = {};
  let embeddedResourcesCount = 0;

  // 1. Extension vs File Signature Mismatch
  if (actualFormat && actualFormat !== ext) {
    findings.push({
      id: 'f-ext-mismatch',
      level: 'HIGH_RISK',
      rule: 'FORMAT_EXTENSION_MISMATCH',
      description: `File extension ".${ext}" does not match its detected internal format "${actualFormat.toUpperCase()}".`,
      technicalDetails: `The file has magic bytes corresponding to ${actualFormat}, but was declared as .${ext}. Possible MIME spoofing.`,
    });
  } else if (!validation.valid && !detectedMagic) {
    findings.push({
      id: 'f-invalid-signature',
      level: 'HIGH_RISK',
      rule: 'INVALID_OR_CORRUPT_HEADER',
      description: validation.error || 'File signature is unrecognized or malformed.',
    });
  }

  // 2. OpenXML Archive Deep Inspection (DOCX, XLSX, PPTX, or ZIP containers)
  const isZipBased = ext === 'docx' || ext === 'xlsx' || ext === 'pptx' || actualFormat === 'docx' || actualFormat === 'xlsx' || actualFormat === 'pptx';
  if (isZipBased) {
    try {
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(zip.files);
      embeddedResourcesCount = fileNames.filter((f) => f.includes('/media/') || f.includes('/embeddings/')).length;

      // Check for decompression bomb risk (BUG-10 Fix)
      let totalUncompressedEstimate = 0;
      for (const fName of fileNames) {
        const fileEntry = zip.files[fName] as any;
        totalUncompressedEstimate += fileEntry._data?.uncompressedSize || 0;
      }
      if (totalUncompressedEstimate > 75 * 1024 * 1024) {
        findings.push({
          id: 'f-decompression-bomb',
          level: 'HIGH_RISK',
          rule: 'ARCHIVE_DECOMPRESSION_BOMB_RISK',
          description: `Archive expansion exceeds 75MB safe threshold (${(totalUncompressedEstimate / (1024 * 1024)).toFixed(1)}MB). High risk of memory exhaustion.`,
        });
      }

      // Check for macros (.bin files, vbaProject.bin)
      const hasVba = fileNames.some((f) => f.toLowerCase().includes('vbaproject.bin') || f.endsWith('.bin'));
      if (hasVba) {
        findings.push({
          id: 'f-vba-macro',
          level: 'HIGH_RISK',
          rule: 'EMBEDDED_VBA_MACRO',
          description: 'Document contains embedded VBA binary macros (vbaProject.bin).',
          technicalDetails: 'Macros can execute arbitrary scripts when opened in desktop Office applications.',
        });
      }

      // Check external target relationships
      const relsFiles = fileNames.filter((f) => f.endsWith('.rels'));
      for (const relPath of relsFiles) {
        const relXml = await zip.files[relPath].async('text');
        if (relXml.includes('TargetMode="External"')) {
          const externalTargets = Array.from(relXml.matchAll(/Target="([^"]+)"/g)).map((m) => m[1]);
          findings.push({
            id: `f-ext-rels-${relPath}`,
            level: 'WARNING',
            rule: 'EXTERNAL_NETWORK_TARGET',
            description: `Document links to external URL resource(s) in "${relPath}".`,
            technicalDetails: `Sample external targets: ${externalTargets.slice(0, 3).join(', ')}`,
          });
        }
      }

      // Check for Core / App Metadata
      const coreXml = zip.file('docProps/core.xml');
      if (coreXml) {
        const coreText = await coreXml.async('text');
        const creator = coreText.match(/<dc:creator>(.*?)<\/dc:creator>/)?.[1];
        const lastModifiedBy = coreText.match(/<cp:lastModifiedBy>(.*?)<\/cp:lastModifiedBy>/)?.[1];
        if (creator) metadataSummary['Author / Creator'] = creator;
        if (lastModifiedBy) metadataSummary['Last Modified By'] = lastModifiedBy;
      }
    } catch (err: any) {
      // If it failed to decompress
      if (isZipBased && ext !== 'pdf') {
        findings.push({
          id: 'f-archive-corrupt',
          level: 'HIGH_RISK',
          rule: 'ARCHIVE_EXTRACTION_FAILURE',
          description: `Corrupted ZIP container: ${err?.message || 'Unable to decompress'}`,
        });
      }
    }
  }

  // 3. PDF Deep Stream Inspection
  if (ext === 'pdf' || actualFormat === 'pdf') {
    try {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder('latin1').decode(buffer);

      // Password / encryption
      if (text.includes('/Encrypt')) {
        findings.push({
          id: 'f-pdf-encrypted',
          level: 'HIGH_RISK',
          rule: 'ENCRYPTED_OR_PASSWORD_PROTECTED',
          description: 'PDF has an active /Encrypt dictionary requiring password credentials.',
        });
      }

      // JavaScript streams
      if (text.includes('/JavaScript') || text.includes('/JS')) {
        findings.push({
          id: 'f-pdf-js',
          level: 'HIGH_RISK',
          rule: 'EMBEDDED_JAVASCRIPT',
          description: 'PDF contains active /JavaScript action triggers.',
          technicalDetails: 'Client-side scripts inside PDFs can execute upon page rendering.',
        });
      }

      // Launch Actions
      if (text.includes('/Launch')) {
        findings.push({
          id: 'f-pdf-launch',
          level: 'HIGH_RISK',
          rule: 'SUSPICIOUS_LAUNCH_ACTION',
          description: 'PDF contains a /Launch directive capable of spawning host processes.',
        });
      }

      // Metadata extraction
      const authorMatch = text.match(/\/Author\s*\((.*?)\)/);
      const producerMatch = text.match(/\/Producer\s*\((.*?)\)/);
      if (authorMatch) metadataSummary['PDF Author'] = authorMatch[1];
      if (producerMatch) metadataSummary['PDF Producer'] = producerMatch[1];
    } catch (err: any) {
      findings.push({
        id: 'f-pdf-corrupt',
        level: 'WARNING',
        rule: 'PDF_INSPECTION_WARN',
        description: `Could not parse PDF byte streams: ${err?.message}`,
      });
    }
  }

  // Calculate overall risk
  const hasHighRisk = findings.some((f) => f.level === 'HIGH_RISK');
  const hasWarning = findings.some((f) => f.level === 'WARNING');
  const overallRisk: ForensicsReport['overallRisk'] = hasHighRisk
    ? 'HIGH'
    : hasWarning
      ? 'MEDIUM'
      : 'LOW';

  return {
    fileName: file.name,
    declaredExtension: ext,
    actualFormat,
    fileSizeBytes: file.size,
    sha256,
    findings,
    overallRisk,
    inspectedAt: Date.now(),
    metadataSummary,
    embeddedResourcesCount,
  };
}
