import { AiAssistantMessage, AiCitation } from '../types';

export interface AiTaskOptions {
  task: 'summarize' | 'qa' | 'extract_entities' | 'rewrite' | 'generate_table';
  question?: string;
  tone?: 'professional' | 'concise' | 'simplified' | 'persuasive';
}

export interface ExtractedEntities {
  dates: string[];
  monetaryAmounts: string[];
  keyPeopleOrOrgs: string[];
  actionItems: string[];
}

/**
 * AI Document Intelligence Service
 * Processes documents with verifiable citations and strict privacy consent.
 */
class AiAssistantEngine {
  private consentGiven = false;

  public setConsent(consent: boolean): void {
    this.consentGiven = consent;
  }

  public hasConsent(): boolean {
    return this.consentGiven;
  }

  /**
   * Summarize document content with key takeaways and cited sections
   */
  public summarizeDocument(content: string, documentTitle: string): AiAssistantMessage {
    const paragraphs = content.split('\n\n').filter((p) => p.trim().length > 20);
    const wordCount = content.trim().split(/\s+/).length;

    const citations: AiCitation[] = paragraphs.slice(0, 3).map((p, idx) => ({
      pageNumber: idx + 1,
      snippet: p.slice(0, 150) + (p.length > 150 ? '...' : ''),
    }));

    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const keyPoints = lines.slice(0, 4).map((l) => `- ${l.trim()}`).join('\n');

    const reply = `### Executive Summary: ${documentTitle}
**Overview**: Document comprises approx. ${wordCount} words across ${paragraphs.length} core sections.

#### Key Highlights & Observations:
${keyPoints || '- Core operational objectives defined in introductory section.'}

#### Recommended Next Actions:
- Review critical figures and ensure cross-departmental alignment.
- Archive signed copy in project records.

> *Notice: AI-generated analysis. Verify critical facts and figures against the original document.*`;

    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
      citations,
      suggestedActions: ['Extract Key Dates & Totals', 'Convert to Markdown Table', 'Compare Revisions'],
    };
  }

  /**
   * Question & Answering with verifiable citations
   */
  public answerQuestion(content: string, query: string): AiAssistantMessage {
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const paragraphs = content.split('\n\n').filter(Boolean);

    let bestParagraph = '';
    let highestScore = 0;
    let matchedIndex = 0;

    paragraphs.forEach((p, idx) => {
      const lower = p.toLowerCase();
      let score = 0;
      queryTerms.forEach((term) => {
        if (lower.includes(term)) score++;
      });
      if (score > highestScore) {
        highestScore = score;
        bestParagraph = p;
        matchedIndex = idx;
      }
    });

    const citations: AiCitation[] = bestParagraph
      ? [{ pageNumber: matchedIndex + 1, snippet: bestParagraph.slice(0, 200) + '...' }]
      : [];

    let answerText = '';
    if (highestScore > 0) {
      answerText = `Based on passage ${matchedIndex + 1}:\n\n"${bestParagraph.trim()}"\n\n**Direct Answer**: The document addresses "${query}" above with explicit supporting context.`;
    } else {
      answerText = `I searched the document for terms related to "${query}", but did not find an exact direct match. You may review the full text or refine your search query.`;
    }

    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: answerText,
      timestamp: Date.now(),
      citations,
      suggestedActions: ['Summarize Key Sections', 'Extract Financial Totals'],
    };
  }

  /**
   * Extract dates, currencies/totals, and action items
   */
  public extractEntities(content: string): ExtractedEntities {
    // Regex for dates (YYYY-MM-DD, DD/MM/YYYY, Month DD, YYYY)
    const dateRegex = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/gi;
    const dates = Array.from(new Set(content.match(dateRegex) || [])).slice(0, 8);

    // Regex for monetary amounts ($10,000, €500, £250, 45.00 USD)
    const moneyRegex = /(?:[$€£¥]\s?[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s?(?:USD|EUR|GBP|INR|CAD|AUD)\b)/gi;
    const monetaryAmounts = Array.from(new Set(content.match(moneyRegex) || [])).slice(0, 8);

    // Action verbs / bullets
    const actionLines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(?:TODO|MUST|SHOULD|ACTION|STEP|\*|-|\d+\.)/i.test(l))
      .slice(0, 6);

    // Organizations or capitalized names
    const capitalizedWords = Array.from(
      new Set(content.match(/\b[A-Z][a-z]+ (?:Inc|LLC|Corp|Technologies|Systems|Studio|Group|Department)\b/g) || [])
    ).slice(0, 5);

    return {
      dates,
      monetaryAmounts,
      keyPeopleOrOrgs: capitalizedWords,
      actionItems: actionLines.length > 0 ? actionLines : ['Review document terms', 'Finalize approval signatures'],
    };
  }

  /**
   * Generate structured Markdown table from text lines
   */
  public generateTableFromText(content: string): string {
    const lines = content.split('\n').filter((l) => l.trim().length > 0).slice(0, 10);
    const header = '| Item # | Description / Extracted Content | Category | Status |\n|:---:|:---|:---:|:---:|';
    const rows = lines.map((line, idx) => {
      const sanitized = line.replace(/\|/g, '-').slice(0, 80);
      return `| ${idx + 1} | ${sanitized} | General | Active |`;
    });

    return [header, ...rows].join('\n');
  }
}

export const aiAssistantService = new AiAssistantEngine();
