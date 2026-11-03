import { DiffResult, DiffToken } from '../types';

/**
 * Compare two texts using an LCS (Longest Common Subsequence) diff algorithm
 */
export function computeTextDiff(
  oldText: string,
  newText: string,
  oldTitle = 'Original Document',
  newTitle = 'Revised Document'
): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const matrix: number[][] = Array(oldLines.length + 1)
    .fill(0)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 0; i < oldLines.length; i++) {
    for (let j = 0; j < newLines.length; j++) {
      if (oldLines[i] === newLines[j]) {
        matrix[i + 1][j + 1] = matrix[i][j] + 1;
      } else {
        matrix[i + 1][j + 1] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  let i = oldLines.length;
  let j = newLines.length;
  const reversedTokens: DiffToken[] = [];

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      reversedTokens.push({ type: 'same', text: oldLines[i - 1] });
      unchanged++;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      reversedTokens.push({ type: 'add', text: newLines[j - 1] });
      additions++;
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      reversedTokens.push({ type: 'del', text: oldLines[i - 1] });
      deletions++;
      i--;
    }
  }

  const tokens = reversedTokens.reverse();

  return {
    oldTitle,
    newTitle,
    tokens,
    stats: {
      additions,
      deletions,
      unchanged,
    },
  };
}

/**
 * Generate a clean Markdown / Text Change Report from diff results
 */
export function generateChangeReport(diff: DiffResult): string {
  const dateStr = new Date().toISOString();
  const lines: string[] = [
    `# OmniDoc Studio — Document Change Report`,
    `Generated on: ${dateStr}`,
    `Comparing: "${diff.oldTitle}" vs "${diff.newTitle}"`,
    ``,
    `## Summary Statistics`,
    `- Lines Added (+): ${diff.stats.additions}`,
    `- Lines Removed (-): ${diff.stats.deletions}`,
    `- Unchanged Lines: ${diff.stats.unchanged}`,
    ``,
    `## Line-by-Line Changes`,
    '```diff',
  ];

  diff.tokens.forEach((t) => {
    if (t.type === 'add') {
      lines.push(`+ ${t.text}`);
    } else if (t.type === 'del') {
      lines.push(`- ${t.text}`);
    } else {
      lines.push(`  ${t.text}`);
    }
  });

  lines.push('```');
  return lines.join('\n');
}
