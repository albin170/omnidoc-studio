import { 
  WorkflowDefinition, 
  WorkflowNode, 
  WorkflowEdge, 
  FileFormat,
  DocumentDnaProfile,
  ForensicsReport,
  DnaComparisonResult,
  TransformationReceipt,
  LineageManifest
} from '../types';
import { validateFileFormat } from './formatDetector';
import { validateDocumentPackage } from './fileValidator';
import { inspectDocumentForensics } from './forensicsService';
import { generateDocumentDna, compareDocumentDna } from './documentDnaService';
import { convertWithSelfHealing } from './selfHealingService';
import { createTransformationReceipt } from './receiptService';
import { extractDocumentLineage } from './lineageService';

export interface WorkflowLogEntry {
  timestamp: number;
  nodeId: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface WorkflowExecutionContext {
  workflowId: string;
  inputFile?: File | Blob;
  inputFileName: string;
  detectedFormat?: FileFormat;
  sourceDna?: DocumentDnaProfile;
  forensicsReport?: ForensicsReport;
  targetFormat: FileFormat;
  convertedBlob?: Blob;
  convertedFileName?: string;
  targetDna?: DocumentDnaProfile;
  dnaComparison?: DnaComparisonResult;
  receipt?: TransformationReceipt;
  lineage?: LineageManifest;
  logs: WorkflowLogEntry[];
  success: boolean;
  totalDurationMs: number;
}

export const PRESET_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'enterprise-verified-pipeline',
    name: 'Enterprise Verified Pipeline',
    description: 'Complete zero-trust document processing: screening, DNA fingerprinting, conversion, integrity verification, and cryptographic receipting.',
    nodes: [
      { id: 'node-upload', type: 'upload', title: 'Document Intake', config: {}, x: 50, y: 150, status: 'idle' },
      { id: 'node-detect', type: 'detect', title: 'Format Detection', config: {}, x: 260, y: 150, status: 'idle' },
      { id: 'node-forensics', type: 'forensics', title: 'Forensic Screening', config: {}, x: 470, y: 80, status: 'idle' },
      { id: 'node-dna', type: 'dna', title: 'Structural DNA Fingerprint', config: {}, x: 470, y: 220, status: 'idle' },
      { id: 'node-convert', type: 'convert', title: 'Self-Healing Engine', config: { targetFormat: 'pdf' }, x: 680, y: 150, status: 'idle' },
      { id: 'node-verify', type: 'verify', title: 'Integrity Verification', config: {}, x: 890, y: 150, status: 'idle' },
      { id: 'node-receipt', type: 'receipt', title: 'Cryptographic Receipt', config: {}, x: 1100, y: 150, status: 'idle' },
      { id: 'node-export', type: 'export', title: 'Secure Dispatch', config: {}, x: 1310, y: 150, status: 'idle' },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'node-upload', toNodeId: 'node-detect' },
      { id: 'e2', fromNodeId: 'node-detect', toNodeId: 'node-forensics' },
      { id: 'e3', fromNodeId: 'node-detect', toNodeId: 'node-dna' },
      { id: 'e4', fromNodeId: 'node-forensics', toNodeId: 'node-convert' },
      { id: 'e5', fromNodeId: 'node-dna', toNodeId: 'node-convert' },
      { id: 'e6', fromNodeId: 'node-convert', toNodeId: 'node-verify' },
      { id: 'e7', fromNodeId: 'node-verify', toNodeId: 'node-receipt' },
      { id: 'e8', fromNodeId: 'node-receipt', toNodeId: 'node-export' },
    ],
    updatedAt: Date.now(),
  },
  {
    id: 'forensic-security-screening',
    name: 'Security & Deep Forensics',
    description: 'Thorough inspection for weaponized macros, embedded payload links, metadata leaks, and MIME-spoofing.',
    nodes: [
      { id: 'node-upload', type: 'upload', title: 'Document Intake', config: {}, x: 50, y: 150, status: 'idle' },
      { id: 'node-detect', type: 'detect', title: 'Format Detection', config: {}, x: 280, y: 150, status: 'idle' },
      { id: 'node-validate', type: 'validate', title: 'Package Integrity', config: {}, x: 510, y: 150, status: 'idle' },
      { id: 'node-forensics', type: 'forensics', title: 'Forensic Lab Screening', config: {}, x: 740, y: 150, status: 'idle' },
      { id: 'node-receipt', type: 'receipt', title: 'Audit Certificate', config: {}, x: 970, y: 150, status: 'idle' },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'node-upload', toNodeId: 'node-detect' },
      { id: 'e2', fromNodeId: 'node-detect', toNodeId: 'node-validate' },
      { id: 'e3', fromNodeId: 'node-validate', toNodeId: 'node-forensics' },
      { id: 'e4', fromNodeId: 'node-forensics', toNodeId: 'node-receipt' },
    ],
    updatedAt: Date.now(),
  },
  {
    id: 'document-lineage-dna',
    name: 'Data Lineage & Provenance Extraction',
    description: 'Map extracted financial and operational fields with confidence metrics, page anchors, and DNA profiles.',
    nodes: [
      { id: 'node-upload', type: 'upload', title: 'Document Intake', config: {}, x: 50, y: 150, status: 'idle' },
      { id: 'node-detect', type: 'detect', title: 'Format Detection', config: {}, x: 280, y: 150, status: 'idle' },
      { id: 'node-dna', type: 'dna', title: 'Structural DNA Profile', config: {}, x: 510, y: 150, status: 'idle' },
      { id: 'node-verify', type: 'verify', title: 'Lineage Extraction', config: {}, x: 740, y: 150, status: 'idle' },
      { id: 'node-export', type: 'export', title: 'Export Manifest', config: {}, x: 970, y: 150, status: 'idle' },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'node-upload', toNodeId: 'node-detect' },
      { id: 'e2', fromNodeId: 'node-detect', toNodeId: 'node-dna' },
      { id: 'e3', fromNodeId: 'node-dna', toNodeId: 'node-verify' },
      { id: 'e4', fromNodeId: 'node-verify', toNodeId: 'node-export' },
    ],
    updatedAt: Date.now(),
  }
];

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  file: File | Blob,
  fileName: string,
  options?: {
    targetFormat?: FileFormat;
    onNodeStatusChange?: (nodeId: string, status: WorkflowNode['status'], error?: string) => void;
    onLog?: (log: WorkflowLogEntry) => void;
  }
): Promise<WorkflowExecutionContext> {
  const startTime = performance.now();
  const logs: WorkflowLogEntry[] = [];
  const targetFormat: FileFormat = options?.targetFormat || 'pdf';

  const context: WorkflowExecutionContext = {
    workflowId: workflow.id,
    inputFile: file,
    inputFileName: fileName,
    targetFormat,
    logs,
    success: true,
    totalDurationMs: 0,
  };

  const addLog = (nodeId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const entry: WorkflowLogEntry = { timestamp: Date.now(), nodeId, message, level };
    logs.push(entry);
    options?.onLog?.(entry);
  };

  // Topological sorting of nodes
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of workflow.nodes) {
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    if (inDegree.has(edge.toNodeId) && outgoing.has(edge.fromNodeId)) {
      inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) || 0) + 1);
      outgoing.get(edge.fromNodeId)?.push(edge.toNodeId);
    }
  }

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const executionOrder: WorkflowNode[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodeMap.get(currentId);
    if (node) executionOrder.push(node);
    for (const neighborId of outgoing.get(currentId) || []) {
      const nextDeg = (inDegree.get(neighborId) || 1) - 1;
      inDegree.set(neighborId, nextDeg);
      if (nextDeg === 0) queue.push(neighborId);
    }
  }

  // If graph had cycles, fallback to original array order
  const finalSequence = executionOrder.length === workflow.nodes.length ? executionOrder : workflow.nodes;

  for (const node of finalSequence) {
    options?.onNodeStatusChange?.(node.id, 'running');
    addLog(node.id, `Starting stage: ${node.title} (${node.type})`);

    try {
      switch (node.type) {
        case 'upload': {
          if (!context.inputFile || context.inputFile.size === 0) {
            throw new Error('Input document is empty or missing');
          }
          addLog(node.id, `Loaded input document "${fileName}" (${(context.inputFile.size / 1024).toFixed(1)} KB)`);
          break;
        }

        case 'detect': {
          const fileObj = context.inputFile instanceof File ? context.inputFile : new File([context.inputFile!], fileName);
          const detection = await validateFileFormat(fileObj);
          context.detectedFormat = detection.format || 'txt';
          addLog(node.id, `Detected format: ${context.detectedFormat.toUpperCase()}`);
          break;
        }

        case 'validate': {
          const fileObj = context.inputFile instanceof File ? context.inputFile : new File([context.inputFile!], fileName);
          const pkgValidation = await validateDocumentPackage(fileObj);
          if (!pkgValidation.valid) {
            addLog(node.id, `Package issue: ${pkgValidation.message}`, 'warn');
          } else {
            addLog(node.id, 'Package structure and MIME signature validated successfully');
          }
          break;
        }

        case 'forensics': {
          const fileObj = context.inputFile instanceof File ? context.inputFile : new File([context.inputFile!], fileName);
          const report = await inspectDocumentForensics(fileObj);
          context.forensicsReport = report;
          addLog(node.id, `Forensic screening risk score: ${report.overallRisk} (${report.findings.length} findings)`, report.overallRisk === 'HIGH' ? 'warn' : 'info');
          break;
        }

        case 'dna': {
          const profile = await generateDocumentDna(context.inputFile!, fileName);
          context.sourceDna = profile;
          addLog(node.id, `Document DNA computed: ${profile.wordCount} words, ${profile.tableCount} tables, ${profile.imageCount} images, hash: ${profile.sha256.slice(0, 12)}...`);
          break;
        }

        case 'convert': {
          const srcFormat = context.detectedFormat || 'docx';
          const healingResult = await convertWithSelfHealing(context.inputFile!, srcFormat, context.targetFormat);
          context.convertedBlob = healingResult.outputBlob;
          context.convertedFileName = healingResult.outputFileName;
          addLog(node.id, `Self-healing conversion completed via strategy '${healingResult.strategyUsed}' with output ${healingResult.outputFileName}`);
          break;
        }

        case 'verify': {
          if (context.convertedBlob) {
            const targetDna = await generateDocumentDna(context.convertedBlob, context.convertedFileName || 'converted');
            context.targetDna = targetDna;
            if (context.sourceDna) {
              const comp = compareDocumentDna(context.sourceDna, targetDna);
              context.dnaComparison = comp;
              addLog(node.id, `Conversion verified: Fidelity Score ${comp.fidelityScore}% (${comp.summary})`, comp.fidelityScore < 60 ? 'warn' : 'info');
            }
          } else {
            // Standalone Lineage / Verification path
            const lineage = await extractDocumentLineage(context.inputFile!, fileName);
            context.lineage = lineage;
            addLog(node.id, `Data lineage analyzed: ${lineage.fields.length} key fields tracked across document`);
          }
          break;
        }

        case 'receipt': {
          if (context.inputFile && context.convertedBlob) {
            const receipt = await createTransformationReceipt(
              context.inputFile,
              context.convertedBlob,
              fileName,
              context.convertedFileName || `${fileName}.${context.targetFormat}`,
              context.detectedFormat || 'docx',
              context.targetFormat,
              context.dnaComparison?.fidelityScore || 95,
              context.dnaComparison?.errors.length || 0,
              context.dnaComparison?.warnings.length || 0,
              Math.round(performance.now() - startTime)
            );
            context.receipt = receipt;
            addLog(node.id, `Generated cryptographic receipt: ${receipt.receiptId} with HMAC signature`);
          } else {
            addLog(node.id, 'Workflow audit receipt logged for document inspection');
          }
          break;
        }

        case 'export': {
          addLog(node.id, 'Artifact prepared for secure client download or persistence');
          break;
        }
      }

      options?.onNodeStatusChange?.(node.id, 'completed');
    } catch (err: any) {
      context.success = false;
      const errorMsg = err?.message || String(err);
      addLog(node.id, `Stage failed: ${errorMsg}`, 'error');
      options?.onNodeStatusChange?.(node.id, 'error', errorMsg);
      break;
    }
  }

  context.totalDurationMs = Math.round(performance.now() - startTime);
  return context;
}
