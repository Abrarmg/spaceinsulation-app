import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generates a jsPDF document from an EstimateDocument HTML DOM element.
 * Letter size (8.5 x 11 in) portrait with multi-page support.
 */
export async function generateEstimateJsPdf(element: HTMLElement): Promise<jsPDF> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc) => {
      // Clean oklch and oklab from all stylesheets text content to prevent html2canvas parsing errors
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
        } catch (_) {}
      });
    },
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 8.5;
  const pageHeight = 11;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 0.1) {
    position = heightLeft - imgHeight;
    pdf.addPage('letter', 'portrait');
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
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
