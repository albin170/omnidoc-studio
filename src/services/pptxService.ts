import pptxgen from 'pptxgenjs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { SlideItem } from '../types';

/**
 * Generate a real PowerPoint (.pptx) file using pptxgenjs
 */
export async function createPresentationBlob(
  presentationTitle: string,
  slides: SlideItem[]
): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.title = presentationTitle || 'OmniDoc Presentation';
  pptx.layout = 'LAYOUT_16x9';

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    // Set background color
    if (slideData.bgColor) {
      slide.background = { color: slideData.bgColor.replace('#', '') };
    }

    // Add elements
    for (const el of slideData.elements) {
      // Coordinate conversions (percentage to inches on 10x5.625 slide)
      const xInch = (el.x / 100) * 10;
      const yInch = (el.y / 100) * 5.625;
      const wInch = (el.width / 100) * 10;
      const hInch = (el.height / 100) * 5.625;

      if (el.type === 'title') {
        slide.addText(el.content || '', {
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
          fontSize: el.fontSize || 32,
          bold: true,
          color: (el.fontColor || '#ffffff').replace('#', ''),
          align: 'left',
          valign: 'middle',
        });
      } else if (el.type === 'text') {
        slide.addText(el.content || '', {
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
          fontSize: el.fontSize || 16,
          color: (el.fontColor || '#e2e8f0').replace('#', ''),
          align: 'left',
          valign: 'top',
        });
      } else if (el.type === 'shape') {
        slide.addShape(pptx.ShapeType.rect, {
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
          fill: { color: (el.bgColor || '#334155').replace('#', '') },
          line: { color: '475569', width: 1 },
        });
      }
    }
  }

  const output = await pptx.write({ outputType: 'blob' });
  return output as Blob;
}

/**
 * Convert slides representation to a multi-page PDF document
 */
export async function convertSlidesToPdf(
  title: string,
  slides: SlideItem[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 16:9 Landscape dimensions in points: 960 x 540
  const width = 960;
  const height = 540;

  for (let idx = 0; idx < slides.length; idx++) {
    const slide = slides[idx];
    const page = pdfDoc.addPage([width, height]);

    // Draw background
    const bgRgb = hexToRgb(slide.bgColor || '#0f172a');
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: bgRgb,
    });

    // Draw elements
    for (const el of slide.elements) {
      const elX = (el.x / 100) * width;
      const elY = height - (el.y / 100) * height - ((el.height / 100) * height);
      const elW = (el.width / 100) * width;
      const elH = (el.height / 100) * height;

      if (el.type === 'shape') {
        page.drawRectangle({
          x: elX,
          y: elY,
          width: elW,
          height: elH,
          color: hexToRgb(el.bgColor || '#1e293b'),
        });
      } else if (el.type === 'title') {
        page.drawText(el.content || '', {
          x: elX,
          y: elY + elH / 2 - (el.fontSize || 28) / 3,
          size: el.fontSize || 28,
          font: boldFont,
          color: hexToRgb(el.fontColor || '#ffffff'),
        });
      } else if (el.type === 'text') {
        // Draw multi-line text
        const lines = (el.content || '').split('\n');
        let textY = elY + elH - (el.fontSize || 14);
        for (const line of lines) {
          page.drawText(line, {
            x: elX,
            y: textY,
            size: el.fontSize || 14,
            font,
            color: hexToRgb(el.fontColor || '#cbd5e1'),
          });
          textY -= (el.fontSize || 14) * 1.4;
        }
      }
    }

    // Slide number in footer
    page.drawText(`${idx + 1} / ${slides.length}`, {
      x: width - 70,
      y: 20,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.6),
    });
  }

  return await pdfDoc.save();
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return rgb(0.1, 0.1, 0.15);
  const r = parseInt(sanitized.substring(0, 2), 16) / 255;
  const g = parseInt(sanitized.substring(2, 4), 16) / 255;
  const b = parseInt(sanitized.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}
