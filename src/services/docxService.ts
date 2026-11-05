import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';

export interface DocxTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface DocxContentItem {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'table';
  text?: string;
  runs?: DocxTextRun[];
  tableData?: string[][];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * Generate a real DOCX file blob from document structure
 */
export async function createDocxBlob(title: string, items: DocxContentItem[]): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  // Title heading
  if (title) {
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 300 },
      })
    );
  }

  for (const item of items) {
    if (item.type === 'h1') {
      children.push(
        new Paragraph({
          text: item.text || '',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (item.type === 'h2') {
      children.push(
        new Paragraph({
          text: item.text || '',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (item.type === 'h3') {
      children.push(
        new Paragraph({
          text: item.text || '',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
        })
      );
    } else if (item.type === 'bullet') {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(item.text || '')],
          spacing: { after: 80 },
        })
      );
    } else if (item.type === 'table' && item.tableData && item.tableData.length > 0) {
      const rows = item.tableData.map((rowCells, rowIndex) => {
        return new TableRow({
          children: rowCells.map((cellText) => {
            return new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cellText,
                      bold: rowIndex === 0, // Header row bold
                    }),
                  ],
                }),
              ],
              width: { size: 100 / (rowCells.length || 1), type: WidthType.PERCENTAGE },
            });
          }),
        });
      });

      children.push(
        new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      // Spacer after table
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
    } else {
      // Regular paragraph
      let alignment: any = AlignmentType.LEFT;
      if (item.align === 'center') alignment = AlignmentType.CENTER;
      if (item.align === 'right') alignment = AlignmentType.RIGHT;

      const runs: TextRun[] = [];
      if (item.runs && item.runs.length > 0) {
        for (const r of item.runs) {
          runs.push(
            new TextRun({
              text: r.text || '',
              bold: r.bold,
              italics: r.italic,
              underline: r.underline ? {} : undefined,
            })
          );
        }
      } else {
        runs.push(
          new TextRun({
            text: item.text || '',
            bold: item.bold,
            italics: item.italic,
            underline: item.underline ? {} : undefined,
          })
        );
      }

      children.push(
        new Paragraph({
          alignment,
          children: runs,
          spacing: { after: 140, line: 276 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Converts rich-text HTML from the editor into structured DocxContentItem objects
 */
export function htmlToDocxItems(html: string): DocxContentItem[] {
  if (typeof DOMParser === 'undefined') {
    // Universal regex-based fallback for Node.js / non-browser environments
    const items: DocxContentItem[] = [];
    const trimmed = html.trim();

    if (/<[a-z][\s\S]*>/i.test(trimmed)) {
      const tagRegex = /<(h[1-3]|p|ul|ol|table)[^>]*>([\s\S]*?)<\/\1>/gi;
      let match;
      while ((match = tagRegex.exec(trimmed)) !== null) {
        const tag = match[1].toLowerCase();
        const inner = match[2];

        if (tag === 'h1') {
          items.push({ type: 'h1', text: inner.replace(/<[^>]+>/g, '').trim() });
        } else if (tag === 'h2') {
          items.push({ type: 'h2', text: inner.replace(/<[^>]+>/g, '').trim() });
        } else if (tag === 'h3') {
          items.push({ type: 'h3', text: inner.replace(/<[^>]+>/g, '').trim() });
        } else if (tag === 'ul' || tag === 'ol') {
          const liMatches = Array.from(inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
          for (const lim of liMatches) {
            items.push({ type: 'bullet', text: lim[1].replace(/<[^>]+>/g, '').trim() });
          }
        } else if (tag === 'table') {
          const tableData: string[][] = [];
          const trMatches = Array.from(inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
          for (const trm of trMatches) {
            const cellMatches = Array.from(trm[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi));
            const rowCells = cellMatches.map((cm) => cm[1].replace(/<[^>]+>/g, '').trim());
            if (rowCells.length > 0) tableData.push(rowCells);
          }
          if (tableData.length > 0) items.push({ type: 'table', tableData });
        } else if (tag === 'p') {
          items.push({ type: 'paragraph', text: inner.replace(/<[^>]+>/g, '').trim() });
        }
      }

      if (items.length > 0) return items;
    }

    // Markdown / plain text fallback
    return html.split('\n').filter(Boolean).map((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('# ')) return { type: 'h1', text: trimmedLine.replace('# ', '') };
      if (trimmedLine.startsWith('## ')) return { type: 'h2', text: trimmedLine.replace('## ', '') };
      if (trimmedLine.startsWith('### ')) return { type: 'h3', text: trimmedLine.replace('### ', '') };
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) return { type: 'bullet', text: trimmedLine.replace(/^[-•]\s*/, '') };
      return { type: 'paragraph', text: trimmedLine };
    });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items: DocxContentItem[] = [];

  function extractRuns(node: Node): DocxTextRun[] {
    const runs: DocxTextRun[] = [];

    function walk(n: Node, isBold = false, isItalic = false, isUnderline = false) {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent || '';
        if (text) {
          runs.push({
            text,
            bold: isBold,
            italic: isItalic,
            underline: isUnderline,
          });
        }
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        const tag = el.tagName.toUpperCase();
        const nextBold = isBold || tag === 'B' || tag === 'STRONG';
        const nextItalic = isItalic || tag === 'I' || tag === 'EM';
        const nextUnderline = isUnderline || tag === 'U';

        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i], nextBold, nextItalic, nextUnderline);
        }
      }
    }

    walk(node);
    return runs.length > 0 ? runs : [{ text: node.textContent || '' }];
  }

  const children = Array.from(doc.body.children);
  if (children.length === 0) {
    const rawText = doc.body.textContent || '';
    if (rawText.trim()) {
      items.push({ type: 'paragraph', text: rawText });
    }
    return items;
  }

  for (const child of children) {
    const tag = child.tagName.toUpperCase();
    if (tag === 'H1') {
      items.push({ type: 'h1', text: child.textContent || '' });
    } else if (tag === 'H2') {
      items.push({ type: 'h2', text: child.textContent || '' });
    } else if (tag === 'H3') {
      items.push({ type: 'h3', text: child.textContent || '' });
    } else if (tag === 'UL' || tag === 'OL') {
      const lis = child.querySelectorAll('li');
      lis.forEach((li) => {
        items.push({ type: 'bullet', text: li.textContent || '' });
      });
    } else if (tag === 'TABLE') {
      const tableData: string[][] = [];
      const trs = child.querySelectorAll('tr');
      trs.forEach((tr) => {
        const rowCells: string[] = [];
        tr.querySelectorAll('th, td').forEach((cell) => {
          rowCells.push(cell.textContent?.trim() || '');
        });
        if (rowCells.length > 0) {
          tableData.push(rowCells);
        }
      });
      if (tableData.length > 0) {
        items.push({ type: 'table', tableData });
      }
    } else {
      // Paragraph or div
      const runs = extractRuns(child);
      items.push({
        type: 'paragraph',
        text: child.textContent || '',
        runs,
      });
    }
  }

  return items;
}

/**
 * Extract raw text from a DOCX file using JSZip to parse word/document.xml
 */
export async function extractTextFromDocxFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');

    if (!docXmlFile) {
      throw new Error('word/document.xml not found in DOCX package');
    }

    const xmlText = await docXmlFile.async('text');
    const extractedLines: string[] = [];

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Extract paragraphs <w:p>
      const paragraphs = xmlDoc.getElementsByTagName('w:p');
      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const textNodes = p.getElementsByTagName('w:t');
        let pText = '';
        for (let j = 0; j < textNodes.length; j++) {
          pText += textNodes[j].textContent || '';
        }
        if (pText.trim()) {
          extractedLines.push(pText);
        }
      }
    } else {
      // Regex extraction fallback for Node/headless environments
      const pMatches = xmlText.match(/<w:p[\s>].*?<\/w:p>/gs) || [];
      for (const pXml of pMatches) {
        const tMatches = Array.from(pXml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs)).map((m) => m[1]);
        const pText = tMatches.join('');
        if (pText.trim()) {
          extractedLines.push(pText);
        }
      }
    }

    return extractedLines.join('\n\n');
  } catch (err) {
    console.warn('DOCX XML parsing failed, attempting text fallback:', err);
    return await file.text();
  }
}

/**
 * Convert plain text or structured document text into a clean PDF using pdf-lib
 */
export async function convertTextOrDocxToPdf(
  title: string,
  rawText: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const usableWidth = pageWidth - margin * 2;
  const fontSize = 11;
  const lineHeight = 16;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  // Title
  if (title) {
    currentPage.drawText(title, {
      x: margin,
      y: cursorY,
      size: 20,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.2),
    });
    cursorY -= 32;

    // Underline divider
    currentPage.drawLine({
      start: { x: margin, y: cursorY + 12 },
      end: { x: pageWidth - margin, y: cursorY + 12 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.85),
    });
  }

  // Split lines and handle word wrapping
  const paragraphs = rawText.split('\n');

  for (const para of paragraphs) {
    if (!para.trim()) {
      cursorY -= lineHeight;
      if (cursorY < margin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }
      continue;
    }

    // Wrap paragraph into lines
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (textWidth > usableWidth) {
        if (cursorY < margin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          cursorY = pageHeight - margin;
        }

        currentPage.drawText(currentLine, {
          x: margin,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        cursorY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (cursorY < margin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }

      currentPage.drawText(currentLine, {
        x: margin,
        y: cursorY,
        size: fontSize,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      cursorY -= lineHeight + 4;
    }
  }

  return await pdfDoc.save();
}
