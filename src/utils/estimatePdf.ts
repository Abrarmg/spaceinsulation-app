import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_W_IN = 8.5;
const PAGE_H_IN = 11;
const CONTINUATION_TOP_IN = 0.45;
const BOTTOM_MARGIN_IN = 0.45;

// Bottom edges (CSS px from the element top) of blocks that must not be split across pages.
function blockBoundaries(element: HTMLElement): number[] {
  const top = element.getBoundingClientRect().top;
  return Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-block]'))
    .map(el => el.getBoundingClientRect().bottom - top)
    .sort((a, b) => a - b);
}

/**
 * Generates a Letter-size jsPDF from an EstimateDocument element.
 * Page breaks are placed between [data-pdf-block] elements so rows are never cut in half.
 */
export async function generateEstimateJsPdf(element: HTMLElement): Promise<jsPDF> {
  const boundaries = blockBoundaries(element);
  const cssWidth = element.offsetWidth;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc) => {
      // html2canvas can't parse oklch/oklab colors from Tailwind v4 stylesheets.
      Array.from(clonedDoc.getElementsByTagName('style')).forEach((styleEl) => {
        if (styleEl.textContent) {
          styleEl.textContent = styleEl.textContent
            .replace(/oklch\([^)]+\)/g, '#76C442')
            .replace(/oklab\([^)]+\)/g, '#76C442');
        }
      });
      Array.from(clonedDoc.styleSheets).forEach((sheet) => {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) return;
          for (let i = rules.length - 1; i >= 0; i--) {
            const rule = rules[i];
            if (rule.cssText && (rule.cssText.includes('oklch') || rule.cssText.includes('oklab'))) {
              sheet.deleteRule(i);
            }
          }
        } catch {
          // Cross-origin stylesheets can't be read; they don't affect the document.
        }
      });
    },
  });

  const pxPerCss = canvas.width / cssWidth;
  const totalCss = canvas.height / pxPerCss;
  const pageCss = (cssWidth * PAGE_H_IN) / PAGE_W_IN;
  const continuationTopCss = (cssWidth * CONTINUATION_TOP_IN) / PAGE_W_IN;
  const bottomMarginCss = (cssWidth * BOTTOM_MARGIN_IN) / PAGE_W_IN;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  let start = 0;
  let pageIndex = 0;
  while (start < totalCss - 1) {
    const topPad = pageIndex === 0 ? 0 : continuationTopCss;
    let end = totalCss;
    // The final slice may use the full page; earlier ones keep a bottom margin.
    if (start + pageCss - topPad < totalCss) {
      const limit = start + pageCss - topPad - bottomMarginCss;
      const fit = boundaries.filter(b => b > start + 1 && b <= limit);
      end = fit.length ? fit[fit.length - 1] : limit;
    }

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.ceil((end - start) * pxPerCss);
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, Math.floor(start * pxPerCss), canvas.width, slice.height, 0, 0, canvas.width, slice.height);

    if (pageIndex > 0) pdf.addPage('letter', 'portrait');
    const yIn = (topPad / cssWidth) * PAGE_W_IN;
    const hIn = ((end - start) / cssWidth) * PAGE_W_IN;
    pdf.addImage(slice.toDataURL('image/png', 1.0), 'PNG', 0, yIn, PAGE_W_IN, hIn, undefined, 'FAST');

    start = end;
    pageIndex++;
  }

  return pdf;
}

/**
 * Generates both the jsPDF instance and the raw base64 data string (without data: URI prefix).
 */
export async function generateEstimatePdfBase64(element: HTMLElement): Promise<{ pdf: jsPDF; pdfBase64: string }> {
  const pdf = await generateEstimateJsPdf(element);
  const dataUri = pdf.output('datauristring');
  const pdfBase64 = dataUri.split(',')[1];
  if (!pdfBase64) {
    throw new Error('Failed to extract base64 string from generated estimate PDF.');
  }
  return { pdf, pdfBase64 };
}
