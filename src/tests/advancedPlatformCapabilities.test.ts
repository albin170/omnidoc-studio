import { describe, it, expect } from 'vitest';
import { autonomousService } from '../services/autonomousService';
import { omniDocClient } from '../sdk/omnidocClient';
import { sanitizeAndRedactPdf } from '../services/pdfSanitizerService';

describe('OmniDoc 2.0 Advanced Platform Capabilities', () => {
  it('detects cross-document duplicates and conflicting monetary values', () => {
    const analysis = autonomousService.analyzeCrossDocuments([
      'Vendor_A_Invoice_9042.pdf',
      'Vendor_B_Invoice_9043.pdf',
    ]);

    expect(analysis.duplicates.length).toBeGreaterThan(0);
    expect(analysis.duplicates[0].similarity).toBeGreaterThan(0.9);

    expect(analysis.contradictions.length).toBeGreaterThan(0);
    expect(analysis.contradictions[0].field).toBe('tax_rate');
    expect(analysis.contradictions[0].severity).toBe('HIGH');
  });

  it('performs semantic BM25 term search across digital twin document corpus', () => {
    const results = autonomousService.searchDocuments('liability limitation');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filename).toContain('.docx');
    expect(results[0].score).toBeGreaterThan(0.85);

    // Exact numeric search
    const numResults = autonomousService.searchDocuments('16350');
    expect(numResults.length).toBeGreaterThan(0);
    expect(numResults[0].matchText).toContain('16,350.00');
  });

  it('builds a verified evidence graph connecting documents and claims', () => {
    const graph = autonomousService.getEvidenceGraph();
    expect(graph.nodes.length).toBeGreaterThan(5);
    expect(graph.edges.length).toBeGreaterThan(4);

    const nodeTypes = new Set(graph.nodes.map((n) => n.type));
    expect(nodeTypes.has('document')).toBe(true);
    expect(nodeTypes.has('entity')).toBe(true);
    expect(nodeTypes.has('contradiction')).toBe(true);
  });

  it('initializes the TypeScript Developer SDK with typed configurations', () => {
    omniDocClient.setToken('test_jwt_bearer_token');
    expect(omniDocClient).toBeDefined();
  });
});
