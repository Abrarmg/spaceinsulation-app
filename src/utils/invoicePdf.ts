import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { InvoiceDocument, InvoiceDocumentData } from '../components/invoice/InvoiceDocument';

/**
 * Generates a jsPDF document from an InvoiceDocument HTML DOM element.
 * Letter size (8.5 x 11 in) portrait with multi-page support.
 */
export async function generateInvoiceJsPdf(element: HTMLElement): Promise<jsPDF> {
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
export async function generateInvoicePdfBase64(element: HTMLElement): Promise<{ pdf: jsPDF; pdfBase64: string }> {
  const pdf = await generateInvoiceJsPdf(element);
  const dataUri = pdf.output('datauristring');
  const pdfBase64 = dataUri.split(',')[1];
  if (!pdfBase64) {
    throw new Error('Failed to extract base64 string from generated invoice PDF.');
  }
  return { pdf, pdfBase64 };
}

/**
 * Generates an Invoice PDF from invoice data directly by mounting the InvoiceDocument component offscreen.
 * Useful for list views or automated workflows where the preview element is not already in the DOM.
 */
export async function generateInvoicePdfFromData(invoice: InvoiceDocumentData): Promise<{ pdf: jsPDF; pdfBase64: string }> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '8.5in';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  const root = createRoot(container);

  return new Promise<{ pdf: jsPDF; pdfBase64: string }>((resolve, reject) => {
    root.render(React.createElement(InvoiceDocument, { invoice, containerId: 'invoice-doc-headless' }));

    // Wait for DOM to render and any images to paint
    setTimeout(async () => {
      try {
        const docElem = (container.querySelector('#invoice-doc-headless') as HTMLElement) || container;
        const res = await generateInvoicePdfBase64(docElem);
        resolve(res);
      } catch (err) {
        reject(err);
      } finally {
        try {
          root.unmount();
          container.remove();
        } catch (_) {}
      }
    }, 150);
  });
}
