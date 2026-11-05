export interface SimulationParameters {
  documentId?: string;
  documentTitle: string;
  originalPageCount: number;
  fontSizeDeltaPt: number;
  removeColumnsCount: number;
  translationTargetLang?: string;
  targetPageLimit?: number;
}

export interface SimulationResult {
  isSimulation: boolean;
  originalPageCount: number;
  predictedPageCount: number;
  pageDelta: number;
  predictedOverflow: boolean;
  textExpansionRatio: number;
  tableCompressionRatio: number;
  warnings: string[];
  recommendations: string[];
  simulatedAt: string;
}

export class DocumentWhatIfSimulationService {
  /**
   * Run client-side / hybrid What-If layout simulation (Module 14)
   */
  public simulateModifications(params: SimulationParameters): SimulationResult {
    const origPages = Math.max(1, params.originalPageCount);

    // Translation expansion multiplier
    let expansionRatio = 1.0;
    if (params.translationTargetLang) {
      const l = params.translationTargetLang.toLowerCase();
      if (['de', 'german', 'es', 'spanish', 'fr', 'french'].includes(l)) {
        expansionRatio = 1.28;
      } else if (['ru', 'russian', 'pt', 'portuguese'].includes(l)) {
        expansionRatio = 1.20;
      } else {
        expansionRatio = 1.10;
      }
    }

    // Font size scaling ratio (approx 8.3% volume per pt delta)
    const fontMultiplier = 1.0 + params.fontSizeDeltaPt * 0.083;

    // Combined ratio
    const combinedRatio = expansionRatio * fontMultiplier;
    const predictedPages = Math.max(1, Math.round(origPages * combinedRatio));

    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (combinedRatio > 1.22) {
      warnings.push('High probability of text overflow onto downstream pages, displacing footers.');
      recommendations.push('Apply a negative font delta (-1.5pt) or reduce paragraph line-spacing to 1.15 to preserve original pagination.');
    }

    if (params.targetPageLimit && predictedPages > params.targetPageLimit) {
      warnings.push(`Predicted page count (${predictedPages}) exceeds target ceiling of ${params.targetPageLimit} pages.`);
      recommendations.push(`Reduce margins by 0.25in and font size by ${(predictedPages - params.targetPageLimit) * 1.2}pt to compress content into ${params.targetPageLimit} pages.`);
    }

    if (params.removeColumnsCount > 0) {
      recommendations.push(`Removing ${params.removeColumnsCount} table column(s) frees ~${params.removeColumnsCount * 14}% horizontal width, eliminating column truncation.`);
    }

    return {
      isSimulation: true,
      originalPageCount: origPages,
      predictedPageCount: predictedPages,
      pageDelta: predictedPages - origPages,
      predictedOverflow: predictedPages > origPages,
      textExpansionRatio: Number(combinedRatio.toFixed(3)),
      tableCompressionRatio: Number((1.0 - 0.12 * params.removeColumnsCount).toFixed(2)),
      warnings,
      recommendations,
      simulatedAt: new Date().toISOString(),
    };
  }
}

export const simulationService = new DocumentWhatIfSimulationService();
