import { PDFDocument } from 'pdf-lib';
import { ImageAdjustments, ImageLayer } from '../types';

/**
 * Apply filters (brightness, contrast, saturation, blur, etc.) to a canvas context
 */
export function applyAdjustmentsToCanvas(
  ctx: CanvasRenderingContext2D,
  adjustments: ImageAdjustments
) {
  const filterParts = [
    `brightness(${adjustments.brightness}%)`,
    `contrast(${adjustments.contrast}%)`,
    `saturate(${adjustments.saturation}%)`,
    `blur(${adjustments.blur}px)`,
    `grayscale(${adjustments.grayscale}%)`,
    `sepia(${adjustments.sepia}%)`,
    `invert(${adjustments.invert}%)`,
  ];
  ctx.filter = filterParts.join(' ');
}

/**
 * Smart client-side background removal algorithm
 * Samples perimeter pixels (corners & edges) to determine background key,
 * then performs color-distance alpha feathering without any cloud upload.
 */
export function removeBackgroundAlgorithm(
  canvas: HTMLCanvasElement,
  tolerance: number = 35
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Sample corner pixels to detect dominant background colors
  const cornerCoords = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  const sampleColors: [number, number, number][] = [];
  for (const [x, y] of cornerCoords) {
    const idx = (y * width + x) * 4;
    sampleColors.push([data[idx], data[idx + 1], data[idx + 2]]);
  }

  // Calculate Euclidean distance to the closest background sample
  const featherRange = 25; // Gradual feathering

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let minDistanceSq = Infinity;
    for (const [sr, sg, sb] of sampleColors) {
      const dSq = (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2;
      if (dSq < minDistanceSq) {
        minDistanceSq = dSq;
      }
    }

    const distance = Math.sqrt(minDistanceSq);
    if (distance <= tolerance) {
      // Complete background transparency
      data[i + 3] = 0;
    } else if (distance < tolerance + featherRange) {
      // Soft feathered alpha edge
      const alphaRatio = (distance - tolerance) / featherRange;
      data[i + 3] = Math.round(data[i + 3] * alphaRatio);
    }
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext('2d')!;
  outCtx.putImageData(imgData, 0, 0);

  return outputCanvas;
}

/**
 * Replace transparent background with solid color, gradient, or preset
 */
export function replaceCanvasBackground(
  srcCanvas: HTMLCanvasElement,
  bgType: 'color' | 'gradient',
  bgValue: string
): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = srcCanvas.width;
  result.height = srcCanvas.height;
  const ctx = result.getContext('2d')!;

  if (bgType === 'color') {
    ctx.fillStyle = bgValue || '#ffffff';
    ctx.fillRect(0, 0, result.width, result.height);
  } else if (bgType === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, result.width, result.height);
    if (bgValue === 'sunset') {
      grad.addColorStop(0, '#f97316');
      grad.addColorStop(1, '#ec4899');
    } else if (bgValue === 'ocean') {
      grad.addColorStop(0, '#06b6d4');
      grad.addColorStop(1, '#3b82f6');
    } else if (bgValue === 'neon') {
      grad.addColorStop(0, '#8b5cf6');
      grad.addColorStop(1, '#3b82f6');
    } else {
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, result.width, result.height);
  }

  // Draw original image over background
  ctx.drawImage(srcCanvas, 0, 0);
  return result;
}

/**
 * Render layer overlays (text, watermarks, stickers) onto canvas
 */
export function renderLayersOnCanvas(
  ctx: CanvasRenderingContext2D,
  layers: ImageLayer[],
  scale: number = 1
) {
  for (const layer of layers) {
    ctx.save();
    const x = layer.x * scale;
    const y = layer.y * scale;

    ctx.globalAlpha = layer.opacity ?? 1;

    if (layer.rotation) {
      ctx.translate(x, y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-x, -y);
    }

    if (layer.type === 'text' || layer.type === 'watermark') {
      const fontSize = (layer.fontSize || 24) * scale;
      ctx.font = `600 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = layer.fontColor || '#ffffff';

      if (layer.bgColor) {
        const textMetrics = ctx.measureText(layer.text || '');
        const pad = 6 * scale;
        ctx.fillStyle = layer.bgColor;
        ctx.fillRect(
          x - pad,
          y - fontSize,
          textMetrics.width + pad * 2,
          fontSize + pad * 1.5
        );
      }

      ctx.fillStyle = layer.fontColor || '#ffffff';
      ctx.fillText(layer.text || '', x, y);
    } else if (layer.type === 'sticker') {
      // Draw sticker badge
      const w = (layer.width || 60) * scale;
      const h = (layer.height || 60) * scale;
      ctx.fillStyle = layer.bgColor || '#FF3366';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8 * scale);
      ctx.fill();

      // Sticker label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${14 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.text || '★', x + w / 2, y + h / 2);
    }

    ctx.restore();
  }
}

/**
 * Convert Image Blob to a clean PDF document using pdf-lib
 */
export async function convertImageToPdf(
  imageBlob: Blob,
  options?: { pageSize?: 'A4' | 'fit'; orientation?: 'portrait' | 'landscape' }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const imageBytes = await imageBlob.arrayBuffer();

  const isPng = imageBlob.type === 'image/png' || imageBlob.type === 'image/webp';
  let embeddedImage;

  if (isPng) {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  const imgWidth = embeddedImage.width;
  const imgHeight = embeddedImage.height;

  let pageWidth: number;
  let pageHeight: number;

  if (options?.pageSize === 'fit') {
    pageWidth = imgWidth;
    pageHeight = imgHeight;
  } else {
    // Standard A4: 595.28 x 841.89
    if (options?.orientation === 'landscape' || imgWidth > imgHeight) {
      pageWidth = 841.89;
      pageHeight = 595.28;
    } else {
      pageWidth = 595.28;
      pageHeight = 841.89;
    }
  }

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Scale image to fit within margins
  const margin = options?.pageSize === 'fit' ? 0 : 36;
  const availW = pageWidth - margin * 2;
  const availH = pageHeight - margin * 2;

  const scale = Math.min(availW / imgWidth, availH / imgHeight, 1);
  const drawW = imgWidth * scale;
  const drawH = imgHeight * scale;

  const drawX = (pageWidth - drawW) / 2;
  const drawY = (pageHeight - drawH) / 2;

  page.drawImage(embeddedImage, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
  });

  return await pdfDoc.save();
}

/**
 * Convert any image file to target format (PNG, JPEG, WebP) with quality settings
 */
export async function convertImageFormat(
  file: File,
  targetFormat: 'png' | 'jpg' | 'webp',
  quality: number = 0.92
): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  // Fill white background if target is JPG and original has alpha
  if (targetFormat === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  const mime = targetFormat === 'jpg' ? 'image/jpeg' : `image/${targetFormat}`;
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob([])), mime, quality);
  });
}

/**
 * Rotate canvas by degrees (90, 180, 270)
 */
export function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const normDeg = ((degrees % 360) + 360) % 360;
  const output = document.createElement('canvas');

  if (normDeg === 90 || normDeg === 270) {
    output.width = canvas.height;
    output.height = canvas.width;
  } else {
    output.width = canvas.width;
    output.height = canvas.height;
  }

  const ctx = output.getContext('2d')!;
  ctx.translate(output.width / 2, output.height / 2);
  ctx.rotate((normDeg * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return output;
}

/**
 * Flip canvas horizontally and/or vertically
 */
export function flipCanvas(canvas: HTMLCanvasElement, horizontal: boolean, vertical: boolean): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext('2d')!;

  ctx.translate(horizontal ? canvas.width : 0, vertical ? canvas.height : 0);
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
  ctx.drawImage(canvas, 0, 0);
  return output;
}

/**
 * Crop canvas to bounding rectangle
 */
export function cropCanvas(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  const safeW = Math.max(1, Math.min(width, canvas.width - x));
  const safeH = Math.max(1, Math.min(height, canvas.height - y));
  output.width = safeW;
  output.height = safeH;

  const ctx = output.getContext('2d')!;
  ctx.drawImage(canvas, x, y, safeW, safeH, 0, 0, safeW, safeH);
  return output;
}

/**
 * Resize canvas to target dimensions
 */
export function resizeCanvas(
  canvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(targetWidth));
  output.height = Math.max(1, Math.round(targetHeight));

  const ctx = output.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}
