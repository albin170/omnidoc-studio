import { describe, it, expect } from 'vitest';
import { autonomousService } from '../services/autonomousService';
import { AutonomousJob } from '../types';

describe('Autonomous Document Engineering Engine (OmniDoc 2.0)', () => {
  it('generates a verified DAG execution plan for invoice reconciliation', () => {
    const plan = autonomousService.generatePlan(
      'Reconcile invoices and compute tax variance with Excel report',
      ['invoice_9042.pdf', 'invoice_9043.pdf'],
      'hybrid'
    );

    expect(plan.isValidDag).toBe(true);
    expect(plan.nodes.length).toBe(7);
    expect(plan.nodes[0].toolName).toBe('inspect_file');
    expect(plan.nodes[1].toolName).toBe('parse_document');
    expect(plan.nodes[2].toolName).toBe('extract_fields');
    expect(plan.nodes[3].toolName).toBe('find_duplicates');
    expect(plan.nodes[4].toolName).toBe('request_approval');
    expect(plan.nodes[4].requiresApproval).toBe(true);
    expect(plan.nodes[5].toolName).toBe('generate_report');
    expect(plan.nodes[6].toolName).toBe('verify_output');
  });

  it('progresses through execution steps and halts at the human approval gate', async () => {
    const plan = autonomousService.generatePlan(
      'Reconcile invoices and verify grand total',
      ['inv1.pdf'],
      'local'
    );

    let job: AutonomousJob = {
      id: 'job_test_101',
      title: 'Invoice Intelligence Audit',
      objective: 'Reconcile invoices and verify grand total',
      status: 'running',
      mode: 'local',
      plan,
      currentStepIndex: 0,
      totalSteps: plan.nodes.length,
      createdAt: new Date().toISOString(),
    };

    // Run first batch of steps
    while (job.status === 'running') {
      job = await autonomousService.executeJobStep(job);
      if (job.status === 'awaiting_approval' || job.status === 'completed') break;
    }

    // Must halt at approval gate
    expect(job.status).toBe('awaiting_approval');
    const waitingNode = job.plan.nodes.find((n) => n.status === 'waiting_approval');
    expect(waitingNode).toBeDefined();
    expect(waitingNode?.toolName).toBe('request_approval');

    // Extracted fields must be populated with bounding box evidence
    expect(job.extractedFields).toBeDefined();
    expect(job.extractedFields!['total'].value).toBe('$16,350.00');
    expect(job.extractedFields!['total'].bbox).toBeDefined();
    expect(job.extractedFields!['total'].status).toBe('confirmed');

    // Approve the step to resume execution
    job = await autonomousService.approveStep(job, true);
    while (job.status === 'running') {
      job = await autonomousService.executeJobStep(job);
      if (job.status === 'completed' || job.status === 'failed') break;
    }

    expect(job.status).toBe('completed');
    expect(job.verificationReport).toBeDefined();
    expect(job.verificationReport?.verified).toBe(true);
    expect(job.generatedArtifacts?.length).toBeGreaterThan(0);
    expect(job.generatedArtifacts![0].name).toContain('.xlsx');
  });

  it('safely cancels an active job and marks remaining steps as skipped', () => {
    const plan = autonomousService.generatePlan('Audit contracts', ['doc1.pdf'], 'cloud');
    const job: AutonomousJob = {
      id: 'job_cancel_1',
      title: 'Contract Audit',
      objective: 'Audit contracts',
      status: 'running',
      mode: 'cloud',
      plan,
      currentStepIndex: 0,
      totalSteps: plan.nodes.length,
      createdAt: new Date().toISOString(),
    };

    const cancelled = autonomousService.cancelJob(job);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.plan.nodes.every((n) => n.status === 'skipped')).toBe(true);
  });
});
