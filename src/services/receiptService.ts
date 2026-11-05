import { TransformationReceipt, FileFormat } from '../types';
import { computeFileHash } from './documentDnaService';

const RECEIPTS_KEY = 'omnidoc_transformation_receipts_v2';

/**
 * Dynamic ephemeral signing key management (BUG-02, BUG-16 & BUG-17 Remediation)
 * Prevents embedding hardcoded cryptographic master secrets into client application bundles.
 */
let _cachedSessionHmacKey: string | null = null;

export function getSessionHmacSecret(): string {
  if (_cachedSessionHmacKey) return _cachedSessionHmacKey;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem('omnidoc_ephemeral_receipt_key');
      if (stored && stored.length >= 32) {
        _cachedSessionHmacKey = stored;
        return stored;
      }
    } catch {}
  }

  // Generate 256 bits of cryptographic entropy
  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }

  const generated = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  _cachedSessionHmacKey = generated;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem('omnidoc_ephemeral_receipt_key', generated);
    } catch {}
  }

  return generated;
}

export const DEFAULT_HMAC_SECRET = getSessionHmacSecret();
export const HMAC_ALGORITHM = 'HMAC-SHA256';

export interface CreateReceiptParams {
  sourceFile: File | Blob;
  sourceFormat: FileFormat;
  targetBlob: Blob;
  targetFileName?: string;
  sourceFileName?: string;
  targetFormat: FileFormat;
  integrityScore: number;
  warningCount?: number;
  errorCount?: number;
  executionDurationMs?: number;
  customSecret?: string;
}

/**
 * Builds canonical serialization of receipt parameters for tamper-evident signing
 */
export function buildReceiptSignablePayload(data: {
  receiptId: string;
  timestamp: string;
  sourceHash: string;
  targetHash: string;
  integrityScore: number;
  executionDurationMs: number;
  engine: string;
  version: string;
}): string {
  return [
    data.receiptId,
    data.timestamp,
    data.sourceHash,
    data.targetHash,
    data.integrityScore.toString(),
    data.executionDurationMs.toString(),
    data.engine,
    data.version,
  ].join('::');
}

/**
 * Signs data using real Web Crypto HMAC-SHA-256 (BUG-02 Fix)
 */
export async function signWithHmacSha256(payload: string, secret?: string): Promise<string> {
  const activeSecret = secret || getSessionHmacSecret();
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(activeSecret);
  const dataBytes = encoder.encode(payload);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
    return Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Node.js test environment fallback using Node's crypto
  if (typeof process !== 'undefined') {
    try {
      const nodeCrypto = await import('crypto');
      return nodeCrypto.createHmac('sha256', keyBytes).update(dataBytes).digest('hex');
    } catch {}
  }

  throw new Error('Cryptographic subsystem unavailable: SubtleCrypto or Node.js crypto required for HMAC signing.');
}

/**
 * Verify HMAC-SHA-256 signature of a Transformation Receipt (BUG-02 Fix)
 */
export async function verifyTransformationReceipt(
  receipt: TransformationReceipt,
  secret?: string
): Promise<boolean> {
  if (!receipt || !receipt.digitalSignature) return false;
  const activeSecret = secret || getSessionHmacSecret();

  try {
    const payload = buildReceiptSignablePayload({
      receiptId: receipt.receiptId,
      timestamp: receipt.timestamp,
      sourceHash: receipt.source.sha256,
      targetHash: receipt.target.sha256,
      integrityScore: receipt.integrityScore,
      executionDurationMs: receipt.executionDurationMs,
      engine: receipt.toolchain.engine,
      version: receipt.toolchain.version,
    });

    const expectedSignature = await signWithHmacSha256(payload, activeSecret);
    return expectedSignature.toLowerCase() === receipt.digitalSignature.toLowerCase();
  } catch (err) {
    console.warn('Verification of transformation receipt failed:', err);
    return false;
  }
}

/**
 * Generate a cryptographic transformation receipt for an executed conversion
 */
export async function createTransformationReceipt(
  first: CreateReceiptParams | File | Blob,
  targetBlobArg?: Blob,
  sourceFileNameArg?: string,
  targetFileNameArg?: string,
  sourceFormatArg?: FileFormat,
  targetFormatArg?: FileFormat,
  integrityScoreArg?: number,
  errorCountArg?: number,
  warningCountArg?: number,
  executionDurationMsArg?: number
): Promise<TransformationReceipt> {
  let sourceBlob: File | Blob;
  let targetBlob: Blob;
  let sourceFileName = 'source';
  let targetFileName = 'target';
  let sourceFormat: FileFormat = 'docx';
  let targetFormat: FileFormat = 'pdf';
  let integrityScore = 100;
  let warningCount = 0;
  let errorCount = 0;
  let executionDurationMs = 0;
  let customSecret: string | undefined;

  if (first && typeof first === 'object' && 'sourceFile' in first) {
    const p = first as CreateReceiptParams;
    sourceBlob = p.sourceFile;
    targetBlob = p.targetBlob;
    sourceFileName = p.sourceFileName || (p.sourceFile instanceof File ? p.sourceFile.name : `source.${p.sourceFormat}`);
    targetFileName = p.targetFileName || `target.${p.targetFormat}`;
    sourceFormat = p.sourceFormat;
    targetFormat = p.targetFormat;
    integrityScore = p.integrityScore ?? 100;
    warningCount = p.warningCount ?? 0;
    errorCount = p.errorCount ?? 0;
    executionDurationMs = p.executionDurationMs ?? 0;
    customSecret = p.customSecret;
  } else {
    sourceBlob = first as (File | Blob);
    targetBlob = targetBlobArg || new Blob([]);
    sourceFileName = sourceFileNameArg || (sourceBlob instanceof File ? sourceBlob.name : 'source');
    targetFileName = targetFileNameArg || 'target';
    sourceFormat = sourceFormatArg || 'docx';
    targetFormat = targetFormatArg || 'pdf';
    integrityScore = integrityScoreArg ?? 100;
    errorCount = errorCountArg ?? 0;
    warningCount = warningCountArg ?? 0;
    executionDurationMs = executionDurationMsArg ?? 0;
  }

  const sourceHash = await computeFileHash(sourceBlob);
  const targetHash = await computeFileHash(targetBlob);
  const now = new Date().toISOString();
  const receiptId = `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const toolchain = {
    engine: 'OmniDoc Intelligence Core',
    version: '2.1.0',
    libraries: {
      'pdf-lib': '1.17.1',
      'docx': '9.15.0',
      'xlsx': '0.18.5',
      'jszip': '3.10.2',
    },
  };

  const payloadToSign = buildReceiptSignablePayload({
    receiptId,
    timestamp: now,
    sourceHash,
    targetHash,
    integrityScore,
    executionDurationMs,
    engine: toolchain.engine,
    version: toolchain.version,
  });

  const signature = await signWithHmacSha256(payloadToSign, customSecret || getSessionHmacSecret());

  const receipt: TransformationReceipt = {
    receiptId,
    timestamp: now,
    source: {
      fileName: sourceFileName,
      format: sourceFormat,
      sizeBytes: sourceBlob.size,
      sha256: sourceHash,
    },
    target: {
      fileName: targetFileName,
      format: targetFormat,
      sizeBytes: targetBlob.size,
      sha256: targetHash,
    },
    toolchain,
    integrityScore,
    warningCount,
    errorCount,
    executionDurationMs,
    digitalSignature: signature,
    signatureAlgorithm: HMAC_ALGORITHM,
    verified: true,
  };

  return receipt;
}

/**
 * Retrieve saved receipts from localStorage
 */
export function getStoredReceipts(): TransformationReceipt[] {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load receipts:', err);
    return [];
  }
}

/**
 * Save receipt to local storage audit trail (retaining up to 50 most recent)
 */
export function saveReceipt(receipt: TransformationReceipt): void {
  try {
    const existing = getStoredReceipts();
    const updated = [receipt, ...existing.filter((r) => r.receiptId !== receipt.receiptId)].slice(0, 50);
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save transformation receipt:', err);
  }
}

/**
 * Format receipt as a verifiable markdown certificate for audit exports
 */
export function formatReceiptMarkdown(receipt: TransformationReceipt): string {
  return `
# OmniDoc Studio — Verifiable Transformation Certificate
**Receipt ID**: \`${receipt.receiptId}\`  
**Timestamp**: ${receipt.timestamp}  
**Engine**: ${receipt.toolchain.engine} (v${receipt.toolchain.version})  
**Signature Algorithm**: \`${receipt.signatureAlgorithm || HMAC_ALGORITHM}\`  
**Integrity Fidelity Score**: **${receipt.integrityScore}%**  

---

### Source Artifact
- **File Name**: \`${receipt.source.fileName}\`
- **Format**: \`${receipt.source.format.toUpperCase()}\`
- **Size**: ${(receipt.source.sizeBytes / 1024).toFixed(2)} KB
- **SHA-256 Digest**: \`${receipt.source.sha256}\`

### Target Artifact
- **File Name**: \`${receipt.target.fileName}\`
- **Format**: \`${receipt.target.format.toUpperCase()}\`
- **Size**: ${(receipt.target.sizeBytes / 1024).toFixed(2)} KB
- **SHA-256 Digest**: \`${receipt.target.sha256}\`

---

### Verification Summary
- **Errors**: ${receipt.errorCount}
- **Warnings**: ${receipt.warningCount}
- **Processing Time**: ${receipt.executionDurationMs} ms
- **HMAC-SHA256 Signature**: \`${receipt.digitalSignature}\`

*Digitally authenticated with WebCrypto HMAC-SHA-256 by OmniDoc Studio.*
`.trim();
}
