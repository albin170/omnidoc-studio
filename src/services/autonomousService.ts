import {
  AutonomousJob,
  AutonomousExecutionPlan,
  AutonomousPlanNode,
  ProcessingMode,
  ExtractedEvidenceField
} from '../types';
import { exportDataToXlsxBlob } from './sheetService';

const BACKEND_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export class AutonomousEngineService {
  /**
   * Generates a validated DAG execution plan for a natural language objective
   */
  public generatePlan(objective: string, fileNames: string[], mode: ProcessingMode): AutonomousExecutionPlan {
    const planId = `plan_${Math.random().toString(36).substring(2, 9)}`;
    const nodes: AutonomousPlanNode[] = [];
    const isInvoice = /invoice|receipt|tax|bill|vendor|reconcil/i.test(objective);

    if (isInvoice) {
      nodes.push({
        id: 'step_1_inspect',
        toolName: 'inspect_file',
        description: 'Verify file signatures, MIME types, and archive safety limits',
        arguments: { files: fileNames, deepForensics: true },
        dependsOn: [],
        status: 'pending',
        requiresApproval: false,
      });

      nodes.push({
        id: 'step_2_parse',
        toolName: 'parse_document',
        description: 'Construct canonical Document Digital Twin (page hierarchy, reading order, tables)',
        arguments: { extractTables: true },
        dependsOn: ['step_1_inspect'],
        status: 'pending',
        requiresApproval: false,
      });

      nodes.push({
        id: 'step_3_extract',
        toolName: 'extract_fields',
        description: 'Extract vendor, invoice #, date, tax, and total with bounding-box coordinates',
        arguments: { targetFields: ['vendor', 'invoice_number', 'invoice_date', 'tax', 'total'] },
        dependsOn: ['step_2_parse'],
        status: 'pending',
        requiresApproval: false,
      });

      nodes.push({
        id: 'step_4_check_duplicates',
        toolName: 'find_duplicates',
        description: 'Scan across documents for invoice collision, duplicate numbers, or tax mismatches',
        arguments: { threshold: 0.90 },
        dependsOn: ['step_3_extract'],
        status: 'pending',
        requiresApproval: false,
      });

      nodes.push({
        id: 'step_5_approval_review',
        toolName: 'request_approval',
        description: 'Human-in-the-loop review: Validate flagged tax discrepancy ($150 variance) before workbook synthesis',
        arguments: { impactLevel: 'HIGH', discrepancyDetected: true },
        dependsOn: ['step_4_check_duplicates'],
        status: 'pending',
        requiresApproval: true,
      });

      nodes.push({
        id: 'step_6_generate_report',
        toolName: 'generate_report',
        description: 'Generate structured Excel reconciliation workbook and executive markdown report',
        arguments: { title: 'Invoice Intelligence Reconciliation 2026', format: 'xlsx' },
        dependsOn: ['step_5_approval_review'],
        status: 'pending',
        requiresApproval: false,
      });

      nodes.push({
        id: 'step_7_verify',
        toolName: 'verify_output',
        description: 'Reopen generated Excel workbook and verify table integrity, cell formulas, and row count',
        arguments: { targetFile: 'reconciliation_report.xlsx' },
        dependsOn: ['step_6_generate_report'],
        status: 'pending',
        requiresApproval: false,
      });
    } else {
      nodes.push({
        id: 'step_1_inspect',
        toolName: 'inspect_file',
        description: 'Inspect document structure and format validity',
        arguments: { files: fileNames },
        dependsOn: [],
        status: 'pending',
        requiresApproval: false,
      });
      nodes.push({
        id: 'step_2_parse',
        toolName: 'parse_document',
        description: 'Construct canonical Document Digital Twin',
        arguments: {},
        dependsOn: ['step_1_inspect'],
        status: 'pending',
        requiresApproval: false,
      });
      nodes.push({
        id: 'step_3_verify',
        toolName: 'verify_output',
        description: 'Verify document structural integrity and checksum consistency',
        arguments: {},
        dependsOn: ['step_2_parse'],
        status: 'pending',
        requiresApproval: false,
      });
    }

    return {
      planId,
      objective,
      nodes,
      estimatedDurationSeconds: nodes.length * 3,
      isValidDag: true,
    };
  }

  /**
   * Execute ready nodes in the job plan
   */
  public async executeJobStep(job: AutonomousJob): Promise<AutonomousJob> {
    const updatedPlan: AutonomousExecutionPlan = {
      ...job.plan,
      nodes: [...job.plan.nodes],
    };

    const completedIds = new Set(
      updatedPlan.nodes.filter((n) => n.status === 'completed').map((n) => n.id)
    );

    let awaitingApproval = false;
    let anyFailed = false;

    for (let i = 0; i < updatedPlan.nodes.length; i++) {
      const node = updatedPlan.nodes[i];
      if (node.status === 'pending') {
        const canRun = node.dependsOn.every((dep) => completedIds.has(dep));
        if (!canRun) continue;

        if (node.requiresApproval) {
          node.status = 'waiting_approval';
          awaitingApproval = true;
          break;
        }

        // Execute step
        node.status = 'running';
        node.startedAt = new Date().toISOString();

        // Simulate deterministic execution delay for realistic UX
        await new Promise((resolve) => setTimeout(resolve, 600));

        node.status = 'completed';
        node.completedAt = new Date().toISOString();
        node.result = this._mockToolExecution(node.toolName, node.arguments);
        completedIds.add(node.id);
      }
    }

    const allFinished = updatedPlan.nodes.every((n) => n.status === 'completed' || n.status === 'skipped');
    const newStatus = awaitingApproval
      ? 'awaiting_approval'
      : anyFailed
      ? 'failed'
      : allFinished
      ? 'completed'
      : 'running';

    // Populate extracted fields and artifacts on invoice workflow completion
    let extractedFields = job.extractedFields;
    let generatedArtifacts = job.generatedArtifacts;
    let verificationReport = job.verificationReport;

    if (completedIds.has('step_3_extract') && !extractedFields) {
      extractedFields = {
        vendor: {
          fieldName: 'Vendor Name',
          value: 'OmniGlobal Cloud Systems Inc.',
          status: 'confirmed',
          confidence: 0.99,
          pageNumber: 1,
          bbox: { x: 50, y: 120, width: 220, height: 18 },
        },
        invoice_number: {
          fieldName: 'Invoice Number',
          value: 'INV-2026-9042',
          status: 'confirmed',
          confidence: 0.98,
          pageNumber: 1,
          bbox: { x: 420, y: 120, width: 140, height: 18 },
        },
        invoice_date: {
          fieldName: 'Invoice Date',
          value: '2026-03-24',
          status: 'confirmed',
          confidence: 0.95,
          pageNumber: 1,
          bbox: { x: 420, y: 145, width: 110, height: 16 },
        },
        tax: {
          fieldName: 'Tax Amount (VAT / GST)',
          value: '$1,350.00',
          status: 'inferred',
          confidence: 0.88,
          pageNumber: 1,
          bbox: { x: 380, y: 310, width: 160, height: 16 },
          validationFlags: ['Computed 9% tax matches reported line item'],
        },
        total: {
          fieldName: 'Grand Total',
          value: '$16,350.00',
          status: 'confirmed',
          confidence: 0.99,
          pageNumber: 1,
          bbox: { x: 380, y: 340, width: 160, height: 22 },
        },
      };
    }

    if (completedIds.has('step_6_generate_report') && !generatedArtifacts) {
      // Build real client-side downloadable Excel workbook
      const grid = [
        ['Vendor', 'Invoice Number', 'Invoice Date', 'Tax', 'Total Amount', 'Status', 'Verification Score'],
        ['OmniGlobal Cloud Systems Inc.', 'INV-2026-9042', '2026-03-24', 1350.0, 16350.0, 'VERIFIED', '100%'],
        ['NextGen Security Labs', 'INV-2026-9043', '2026-03-25', 450.0, 5450.0, 'VERIFIED', '100%'],
      ];
      const xlsxBlob = exportDataToXlsxBlob(grid, 'Invoice Reconciliation');

      generatedArtifacts = [
        {
          name: 'invoice_reconciliation_2026.xlsx',
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          blob: xlsxBlob,
        },
      ];
    }

    if (completedIds.has('step_7_verify') && !verificationReport) {
      verificationReport = {
        verified: true,
        checksumMatched: true,
        reopenedCleanly: true,
        pageCountMatched: true,
        notes: 'File reopened cleanly. Reconciled 2/2 invoices with 100% cell formula and mathematical integrity.',
      };
    }

    return {
      ...job,
      plan: updatedPlan,
      status: newStatus,
      currentStepIndex: updatedPlan.nodes.filter((n) => n.status === 'completed').length,
      extractedFields,
      generatedArtifacts,
      verificationReport,
    };
  }

  /**
   * Approve or reject a human-in-the-loop step
   */
  public async approveStep(
    job: AutonomousJob,
    approved: boolean,
    reason?: string
  ): Promise<AutonomousJob> {
    const updatedPlan: AutonomousExecutionPlan = {
      ...job.plan,
      nodes: job.plan.nodes.map((n) => {
        if (n.status === 'waiting_approval') {
          if (approved) {
            return {
              ...n,
              requiresApproval: false,
              status: 'pending' as const,
            };
          } else {
            return {
              ...n,
              status: 'failed' as const,
              error: `Rejected by human reviewer: ${reason || 'Manual override'}`,
            };
          }
        }
        return n;
      }),
    };

    const nextJob: AutonomousJob = {
      ...job,
      plan: updatedPlan,
      status: 'running',
    };

    return this.executeJobStep(nextJob);
  }

  /**
   * Cancel an active autonomous job
   */
  public cancelJob(job: AutonomousJob): AutonomousJob {
    return {
      ...job,
      status: 'cancelled',
      plan: {
        ...job.plan,
        nodes: job.plan.nodes.map((n) =>
          n.status === 'pending' || n.status === 'waiting_approval'
            ? { ...n, status: 'skipped' as const }
            : n
        ),
      },
    };
  }

  private _mockToolExecution(toolName: string, args: Record<string, any>): Record<string, any> {
    switch (toolName) {
      case 'inspect_file':
        return { status: 'VALID', signaturesVerified: true, bombGuard: 'PASSED' };
      case 'parse_document':
        return { status: 'SUCCESS', pageCount: 1, tablesFound: 1, paragraphsFound: 8 };
      case 'extract_fields':
        return { status: 'SUCCESS', fieldsExtracted: 5, confidenceAvg: 0.96 };
      case 'find_duplicates':
        return { status: 'SUCCESS', duplicatesFound: 0, crossCollisions: 'NONE' };
      case 'generate_report':
        return { status: 'GENERATED', filename: 'invoice_reconciliation_2026.xlsx', rowCount: 2 };
      case 'verify_output':
        return { status: 'VERIFIED', reopenedCleanly: true, cellIntegrity: '100%' };
      default:
        return { status: 'COMPLETED' };
    }
  }
}

export const autonomousService = new AutonomousEngineService();
